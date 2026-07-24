const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const { delay } = require("./metrics.cjs");
const { killProcessGroup } = require("./process-tree.cjs");

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error("Chrome/Chromium was not found; set CHROME_PATH to its executable");
  }
  return executable;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForJson(url, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited before its debugging endpoint was ready (${child.exitCode})`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`timed out waiting for ${url}: ${lastError?.message || "unknown error"}`);
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      clearTimeout(waiter.timeout);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result || {});
    });
    socket.addEventListener("close", () => {
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error("Chrome DevTools connection closed"));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    if (typeof WebSocket !== "function") {
      throw new Error("this benchmark requires a Node.js release with global WebSocket support");
    }
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timed out connecting to Chrome")), 10000);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("failed to connect to Chrome DevTools"));
      });
    });
    return new CdpConnection(socket);
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

class BrowserPage {
  constructor(browser, targetId, connection) {
    this.browser = browser;
    this.targetId = targetId;
    this.connection = connection;
  }

  async initialize() {
    await Promise.all([
      this.connection.send("Page.enable"),
      this.connection.send("Runtime.enable"),
      this.connection.send("Network.enable"),
    ]);
    await this.connection.send("Network.setCacheDisabled", { cacheDisabled: true });
  }

  async navigate(url, options = {}) {
    await this.connection.send(
      "Page.navigate",
      { url },
      options.timeoutMs || 30000,
    );
  }

  async evaluate(expression, options = {}) {
    const result = await this.connection.send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: options.awaitPromise !== false,
        returnByValue: true,
      },
      options.timeoutMs || 30000,
    );
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description;
      throw new Error(description || result.exceptionDetails.text || "browser evaluation failed");
    }
    return result.result?.value;
  }

  async waitFor(expression, options = {}) {
    const { timeoutMs = 60000, intervalMs = 10, description = expression } = options;
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(`Boolean(${expression})`)) return;
      } catch (error) {
        lastError = error;
      }
      await delay(intervalMs);
    }
    throw new Error(
      `timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`,
    );
  }

  async close() {
    this.connection.close();
    await fetch(`${this.browser.endpoint}/json/close/${this.targetId}`, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  }
}

class ChromeBrowser {
  constructor(child, endpoint, userDataDir, version) {
    this.child = child;
    this.endpoint = endpoint;
    this.userDataDir = userDataDir;
    this.version = version;
  }

  static async launch() {
    const executable = findChrome();
    const port = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "many-pages-chrome-"));
    const child = spawn(
      executable,
      [
        "--headless=new",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-component-update",
        "about:blank",
      ],
      { detached: process.platform !== "win32", stdio: "ignore" },
    );
    try {
      const endpoint = `http://127.0.0.1:${port}`;
      const version = await waitForJson(`${endpoint}/json/version`, 20000, child);
      return new ChromeBrowser(child, endpoint, userDataDir, version.Browser || "unknown");
    } catch (error) {
      killProcessGroup(child, "SIGKILL");
      fs.rmSync(userDataDir, { recursive: true, force: true });
      throw error;
    }
  }

  async newPage() {
    const response = await fetch(`${this.endpoint}/json/new?about:blank`, { method: "PUT" });
    if (!response.ok) throw new Error(`failed to create Chrome target: HTTP ${response.status}`);
    const target = await response.json();
    const connection = await CdpConnection.connect(target.webSocketDebuggerUrl);
    const page = new BrowserPage(this, target.id, connection);
    await page.initialize();
    return page;
  }

  async close() {
    killProcessGroup(this.child, "SIGTERM");
    await Promise.race([
      new Promise((resolve) => this.child.once("exit", resolve)),
      delay(3000),
    ]);
    killProcessGroup(this.child, "SIGKILL");
    fs.rmSync(this.userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

module.exports = {
  ChromeBrowser,
  findChrome,
  getFreePort,
};
