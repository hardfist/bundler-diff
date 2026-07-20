const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { delay } = require("./metrics.cjs");
const { killProcessGroup } = require("./process-tree.cjs");

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve) => child.once("exit", resolve));
}

async function stopServer(child) {
  killProcessGroup(child, "SIGTERM");
  await Promise.race([waitForExit(child), delay(5000)]);
  killProcessGroup(child, "SIGKILL");
  await Promise.race([waitForExit(child), delay(1000)]);
}

function waitForReady(child, bundler, timeoutMs = 120000) {
  const lines = [];
  let buffer = "";
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${bundler} dev server timed out:\n${lines.slice(-30).join("\n")}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("exit", onExit);
    }

    function onExit(code, signal) {
      cleanup();
      reject(
        new Error(
          `${bundler} dev server exited before ready (${code ?? signal}):\n${lines
            .slice(-30)
            .join("\n")}`,
        ),
      );
    }

    function onData(chunk) {
      buffer += chunk.toString().replace(/\u001b\[[0-9;]*m/g, "");
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop();
      for (const line of parts) {
        if (line.trim()) lines.push(line);
        const marker = line.match(/BENCH_SERVER_READY\s+(https?:\/\/\S+)/);
        const turbopack = line.match(/started server on .+url:\s+(https?:\/\/\S+)/);
        const match = marker || turbopack;
        if (match) {
          cleanup();
          resolve({ url: match[1].replace(/\/$/, ""), logs: lines });
          return;
        }
      }
    }

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", onExit);
  });
}

async function startServer(options) {
  const { bundler, caseDir, fixtureDir, port, turbopackBinary } = options;
  let command;
  let args;
  if (bundler === "turbopack") {
    command = turbopackBinary;
    args = [
      "dev",
      "--dir",
      fixtureDir,
      "--root",
      fixtureDir,
      "src/index.js",
      "--no-open",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ];
  } else {
    command = process.execPath;
    args = [path.join(caseDir, "scripts/start-dev-server.cjs"), bundler, String(port)];
  }

  const child = spawn(command, args, {
    cwd: caseDir,
    detached: process.platform !== "win32",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const ready = await waitForReady(child, bundler);
    // Keep both pipes drained after the readiness marker so verbose compiler
    // output cannot fill an OS pipe and stall the dev server during the run.
    child.stdout?.on("data", () => {});
    child.stderr?.on("data", () => {});
    return {
      ...ready,
      child,
      command: [command, ...args],
      stop: () => stopServer(child),
    };
  } catch (error) {
    await stopServer(child);
    throw error;
  }
}

async function runCommand(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit" });
  const code = await waitForExit(child);
  if (code !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${code}`);
}

async function ensureTurbopackBinary(options) {
  const { repoRoot, explicitBinary, profile = "release" } = options;
  if (explicitBinary) {
    const binary = path.resolve(explicitBinary);
    if (!fs.existsSync(binary)) throw new Error(`Turbopack binary does not exist: ${binary}`);
    return binary;
  }

  const submoduleRoot = path.join(repoRoot, "third_party/turbopack");
  const manifest = path.join(
    submoduleRoot,
    "turbopack/crates/turbopack-cli/Cargo.toml",
  );
  if (!fs.existsSync(manifest)) {
    throw new Error("Turbopack submodule is missing; run git submodule update --init --recursive");
  }
  const executableName = process.platform === "win32" ? "turbopack-cli.exe" : "turbopack-cli";
  const binary = path.join(submoduleRoot, "target", profile, executableName);
  const args = ["build", "--locked", "--manifest-path", manifest, "--bin", "turbopack-cli"];
  if (profile === "release") args.push("--release");
  else if (profile !== "debug") args.push("--profile", profile);
  await runCommand("cargo", args, submoduleRoot);
  if (!fs.existsSync(binary)) throw new Error(`Cargo did not produce ${binary}`);
  return binary;
}

module.exports = {
  ensureTurbopackBinary,
  startServer,
  stopServer,
};
