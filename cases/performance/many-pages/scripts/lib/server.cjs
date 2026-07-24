const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
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

async function waitForFile(file, child, timeoutMs, getRuntimeFailure) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runtimeFailure = getRuntimeFailure();
    if (runtimeFailure) throw runtimeFailure;
    if (fs.existsSync(file)) {
      // Let a preceding stderr write from the server reach this process before
      // accepting a marker emitted while the same span was closing.
      await delay(50);
      const markerFailure = getRuntimeFailure();
      if (markerFailure) throw markerFailure;
      return;
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Turbopack exited before writing its snapshot completion marker (${child.exitCode ?? child.signalCode})`,
      );
    }
    await delay(100);
  }
  throw new Error(`timed out waiting for Turbopack snapshot completion: ${file}`);
}

function validateTurbopackCacheOptions(persistentCache, memoryEviction) {
  if (memoryEviction === "full" && !persistentCache) {
    throw new Error("Turbopack memory eviction requires persistent caching");
  }
}

function snapshotFailureFromOutput(output) {
  return output.match(
    /(Persisting failed:.*|Compaction failed:.*|Unable to write Turbopack snapshot completion marker.*)/,
  )?.[1];
}

function buildServerCommand(options) {
  const {
    bundler,
    caseDir,
    fixtureDir,
    port,
    turbopackBinary,
    turbopackCacheDir,
    turbopackPersistentCache = false,
    turbopackMemoryEviction = "off",
  } = options;
  let command;
  let args;
  if (bundler === "turbopack") {
    validateTurbopackCacheOptions(
      turbopackPersistentCache,
      turbopackMemoryEviction,
    );
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
    if (turbopackPersistentCache) {
      if (!turbopackCacheDir) {
        throw new Error("Turbopack persistent caching requires an isolated cache directory");
      }
      args.push(
        "--persistent-caching",
        "--cache-dir",
        turbopackCacheDir,
        "--turbopack-memory-eviction",
        turbopackMemoryEviction,
      );
    }
  } else {
    command = process.execPath;
    args = [path.join(caseDir, "scripts/start-dev-server.cjs"), bundler, String(port)];
  }
  return { command, args };
}

async function startServer(options) {
  const {
    bundler,
    caseDir,
    turbopackPersistentCache = false,
    turbopackSnapshotIdleMs = 100,
  } = options;
  const useTurbopackPersistentCache =
    bundler === "turbopack" && turbopackPersistentCache;
  const turbopackCacheDir =
    useTurbopackPersistentCache
      ? fs.mkdtempSync(path.join(os.tmpdir(), "bundler-diff-turbopack-cache-"))
      : undefined;
  const turbopackSnapshotCompletionFile = turbopackCacheDir
    ? `${turbopackCacheDir}.snapshot-complete`
    : undefined;
  const { command, args } = buildServerCommand({ ...options, turbopackCacheDir });

  const child = spawn(command, args, {
    cwd: caseDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      NO_COLOR: "1",
      ...(useTurbopackPersistentCache
        ? {
            TURBO_ENGINE_SNAPSHOT_IDLE_TIMEOUT_MILLIS: String(
              turbopackSnapshotIdleMs,
            ),
            TURBO_ENGINE_SNAPSHOT_COMPLETION_FILE:
              turbopackSnapshotCompletionFile,
          }
        : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let runtimeFailure;
  let stopPromise;
  const cleanupCache = () => {
    if (turbopackCacheDir) {
      fs.rmSync(turbopackCacheDir, { recursive: true, force: true });
    }
    if (turbopackSnapshotCompletionFile) {
      fs.rmSync(turbopackSnapshotCompletionFile, { force: true });
    }
  };
  const stop = () => {
    stopPromise ??= stopServer(child).finally(cleanupCache);
    return stopPromise;
  };
  try {
    const ready = await waitForReady(child, bundler);
    // Keep both pipes drained after the readiness marker so verbose compiler
    // output cannot fill an OS pipe and stall the dev server during the run.
    // A closed tracing span is not itself proof that persistence succeeded, so
    // promote every backend failure path to a rejected snapshot wait.
    const drainRuntimeOutput = (chunk) => {
      const output = chunk.toString().replace(/\u001b\[[0-9;]*m/g, "");
      const failure = snapshotFailureFromOutput(output);
      if (failure && !runtimeFailure) {
        runtimeFailure = new Error(failure);
      }
    };
    child.stdout?.on("data", drainRuntimeOutput);
    child.stderr?.on("data", drainRuntimeOutput);
    return {
      ...ready,
      child,
      command: [command, ...args],
      turbopackCacheDir,
      resetTurbopackSnapshotCompletion() {
        if (turbopackSnapshotCompletionFile) {
          fs.rmSync(turbopackSnapshotCompletionFile, { force: true });
        }
      },
      hasTurbopackSnapshotCompletion() {
        return Boolean(
          turbopackSnapshotCompletionFile &&
            fs.existsSync(turbopackSnapshotCompletionFile),
        );
      },
      waitForTurbopackSnapshotCompletion(timeoutMs) {
        if (!turbopackSnapshotCompletionFile) return Promise.resolve();
        return waitForFile(
          turbopackSnapshotCompletionFile,
          child,
          timeoutMs,
          () => runtimeFailure,
        );
      },
      stop,
    };
  } catch (error) {
    await stop();
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

  const manifest = path.join(repoRoot, "crates/turbopack-cli/Cargo.toml");
  if (!fs.existsSync(manifest)) {
    throw new Error(`Turbopack CLI manifest is missing: ${manifest}`);
  }
  const executableName = process.platform === "win32" ? "turbopack-cli.exe" : "turbopack-cli";
  const binary = path.join(repoRoot, "target", profile, executableName);
  const args = ["build", "--locked", "--manifest-path", manifest, "--bin", "turbopack-cli"];
  if (profile === "release") args.push("--release");
  else if (profile !== "debug") args.push("--profile", profile);
  await runCommand("cargo", args, repoRoot);
  if (!fs.existsSync(binary)) throw new Error(`Cargo did not produce ${binary}`);
  return binary;
}

module.exports = {
  buildServerCommand,
  ensureTurbopackBinary,
  snapshotFailureFromOutput,
  startServer,
  stopServer,
  validateTurbopackCacheOptions,
};
