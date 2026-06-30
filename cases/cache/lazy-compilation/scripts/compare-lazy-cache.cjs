const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const caseDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(caseDir, "../../..");
const expectedBaseline = "lazy compilation cache case: 3 eagerly loaded records, weight 24";
const expectedLazyReport = "lazy chunk report: 4 lazy metrics, checksum 41";
const turbopackStatsPrefix = "TURBOPACK_TASK_CACHE_STATS_JSON:";
const turbopackModuleBuildTaskNames = new Set([
  "<turbopack::ModuleAssetContext as dyn turbopack_core::context::AssetContext>::process",
]);

function loadConfig(configPath, env) {
  const previous = {};
  try {
    for (const [key, value] of Object.entries(env)) {
      previous[key] = process.env[key];
      process.env[key] = value;
    }

    delete require.cache[require.resolve(configPath)];
    return require(configPath);
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  const pending = [dir];

  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(port);
        }
      });
    });
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function startWatch(compiler, label) {
  const pending = [];
  const waiters = [];
  const watching = compiler.watch({}, (error, stats) => {
    const item = { error, stats };
    const waiter = waiters.shift();
    if (waiter) {
      waiter(item);
    } else {
      pending.push(item);
    }
  });

  return {
    watching,
    next(description) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`${label}: timed out waiting for ${description}`));
        }, 30000);

        const complete = ({ error, stats }) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
            return;
          }
          if (stats && stats.hasErrors()) {
            reject(new Error(stats.toString({ all: false, errors: true, warnings: true })));
            return;
          }
          resolve(stats);
        };

        const item = pending.shift();
        if (item) {
          complete(item);
        } else {
          waiters.push(complete);
        }
      });
    },
  };
}

function closeWatch(compiler, watching) {
  return new Promise((resolve, reject) => {
    watching.close((watchError) => {
      if (watchError) {
        reject(watchError);
        return;
      }

      if (typeof compiler.close !== "function") {
        resolve();
        return;
      }

      compiler.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve();
        }
      });
    });
  });
}

function toHitRate(cacheHits, total) {
  return total === 0 ? null : cacheHits / total;
}

function formatHitRate(cache) {
  if (cache.hitRate === null) {
    return "n/a";
  }

  return `${(cache.hitRate * 100).toFixed(1)}% (${cache.cacheHits}/${cache.total})`;
}

function summarizeStats(stats) {
  const json = stats.toJson({
    all: false,
    cached: true,
    cachedAssets: true,
    cachedModules: true,
    modules: true,
    timings: true,
  });
  const modules = json.modules || [];
  const cachedModules = modules.filter((module) => module.cached).length;
  const lazyModules = modules.filter((module) => {
    const name = module.name || module.identifier || "";
    return name.includes("src/lazy") || name.includes("lazy/report");
  });

  return {
    time: json.time || 0,
    modules: modules.length,
    cachedModules,
    lazyModules: lazyModules.map((module) => ({
      name: module.name || module.identifier,
      cached: Boolean(module.cached),
    })),
    moduleBuildCache: {
      cacheHits: cachedModules,
      cacheMisses: modules.length - cachedModules,
      total: modules.length,
      hitRate: toHitRate(cachedModules, modules.length),
    },
  };
}

function parseTurbopackTaskStats(output) {
  const line = output
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(turbopackStatsPrefix));

  if (!line) {
    throw new Error("turbopack: expected task cache stats output from --full-stats");
  }

  return JSON.parse(line.slice(turbopackStatsPrefix.length));
}

function isTurbopackModuleBuildTask(name) {
  return turbopackModuleBuildTaskNames.has(name);
}

function summarizeTurbopackModuleBuildCache(output) {
  const stats = parseTurbopackTaskStats(output);
  const entries = Object.entries(stats).filter(([name, value]) => {
    return isTurbopackModuleBuildTask(name) && value.cache_hit + value.cache_miss > 0;
  });
  const cacheHits = entries.reduce((sum, [, value]) => sum + value.cache_hit, 0);
  const cacheMisses = entries.reduce((sum, [, value]) => sum + value.cache_miss, 0);
  const total = cacheHits + cacheMisses;

  return {
    cacheHits,
    cacheMisses,
    total,
    hitRate: toHitRate(cacheHits, total),
    taskCount: entries.length,
  };
}

function readJsFiles(dir) {
  return listFiles(dir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

function parseStringLiteral(literal) {
  try {
    return JSON.parse(literal);
  } catch {
    return undefined;
  }
}

function extractLazyKeys(outputDir) {
  const source = readJsFiles(outputDir);
  const keys = new Set();
  const patterns = [
    /var data = ("(?:\\.|[^"\\])*")/g,
    /data:\s*("(?:\\.|[^"\\])*")/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = parseStringLiteral(match[1]);
      if (value && /lazy|report|weights/.test(value)) {
        keys.add(value);
      }
    }
  }

  return [...keys];
}

function requestOnce(options, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(options, (response) => {
      response.resume();
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${options.path}`));
        } else {
          resolve();
        }
      });
    });
    request.on("error", reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

function triggerWebpackLazy(port, keys) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path: `/lazy-compilation-using-${keys.join("@")}`,
        agent: false,
      },
      (response) => {
        response.once("data", () => {
          request.destroy();
          response.destroy();
          resolve();
        });
        response.once("error", reject);
      }
    );
    request.once("error", reject);
    request.end();
  });
}

function runNode(entryPath, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entryPath], {
      cwd: caseDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let sawExpectedOutput = false;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, 4000);

    const appendOutput = (chunk) => {
      output += chunk;
      if (
        !sawExpectedOutput &&
        output.includes(expectedBaseline) &&
        output.includes(expectedLazyReport)
      ) {
        sawExpectedOutput = true;
        child.kill("SIGTERM");
      }
    };

    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (!output.includes(expectedBaseline) || !output.includes(expectedLazyReport)) {
        reject(new Error(`${label}: expected built entry output, got ${JSON.stringify(output)}`));
        return;
      }
      if (code && !signal) {
        reject(new Error(`${label}: node exited with ${code}\n${output}`));
        return;
      }
      resolve(output);
    });
  });
}

async function runWebpackSession(sessionName) {
  const webpack = require("webpack");
  const outputDir = path.join(caseDir, "dist", "webpack");
  const port = await getFreePort();
  const config = loadConfig(path.join(caseDir, "webpack.config.cjs"), {
    WEBPACK_LAZY_PORT: String(port),
  });
  const compiler = webpack(config);
  const watcher = startWatch(compiler, `webpack ${sessionName}`);

  try {
    const initialStats = await watcher.next("initial lazy proxy compilation");
    const keys = extractLazyKeys(outputDir);
    if (keys.length === 0) {
      throw new Error("webpack: expected lazy compilation proxy keys in emitted output");
    }

    await triggerWebpackLazy(port, keys);
    const activatedStats = await watcher.next("lazy module activation compilation");
    await runNode(path.join(outputDir, "entry.js"), `webpack ${sessionName}`);

    return {
      initial: summarizeStats(initialStats),
      activated: summarizeStats(activatedStats),
      lazyKeys: keys.length,
    };
  } finally {
    await closeWatch(compiler, watcher.watching);
  }
}

async function runRspackSession(sessionName) {
  const rspack = require("@rspack/core");
  const outputDir = path.join(caseDir, "dist", "rspack");
  let middleware = (_request, _response, next) => next();
  const server = http.createServer((request, response) => {
    middleware(request, response, () => {
      response.writeHead(404);
      response.end("not found");
    });
  });
  const port = await listen(server);
  const serverUrl = `http://127.0.0.1:${port}/_rspack/lazy/trigger`;
  const config = loadConfig(path.join(caseDir, "rspack.config.cjs"), {
    RSPACK_LAZY_SERVER_URL: serverUrl,
  });
  const compiler = rspack(config);
  middleware = rspack.lazyCompilationMiddleware(compiler);
  const watcher = startWatch(compiler, `rspack ${sessionName}`);

  try {
    const initialStats = await watcher.next("initial lazy proxy compilation");
    const keys = extractLazyKeys(outputDir);
    if (keys.length === 0) {
      throw new Error("rspack: expected lazy compilation proxy keys in emitted output");
    }

    await requestOnce(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: "/_rspack/lazy/trigger",
        headers: {
          "Content-Type": "text/plain",
        },
      },
      keys.join("\n")
    );
    const activatedStats = await watcher.next("lazy module activation compilation");
    await runNode(path.join(outputDir, "entry.js"), `rspack ${sessionName}`);

    return {
      initial: summarizeStats(initialStats),
      activated: summarizeStats(activatedStats),
      lazyKeys: keys.length,
    };
  } finally {
    await closeWatch(compiler, watcher.watching);
    await closeServer(server);
  }
}

async function verifyLazyBundler(name, runSession, cacheDir, outputDir) {
  fs.rmSync(cacheDir, { force: true, recursive: true });
  fs.rmSync(outputDir, { force: true, recursive: true });

  const cold = await runSession("cold");
  const coldCacheFiles = listFiles(cacheDir).length;
  if (coldCacheFiles === 0) {
    throw new Error(`${name}: expected persistent cache files after cold session`);
  }

  fs.rmSync(outputDir, { force: true, recursive: true });
  const warm = await runSession("warm");
  const warmCacheFiles = listFiles(cacheDir).length;
  if (warmCacheFiles === 0) {
    throw new Error(`${name}: expected persistent cache files after warm session`);
  }

  return {
    name,
    mode: "persistent cache + lazy import activation",
    cacheMetric: "stats.modules.cached in activated compilation",
    cold,
    warm,
    cacheFiles: warmCacheFiles,
  };
}

function runCommand(command, args, label, env = {}) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: caseDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  process.stdout.write(filterMachineOutput(result.stdout || ""));
  process.stderr.write(filterMachineOutput(result.stderr || ""));
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function filterMachineOutput(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(turbopackStatsPrefix))
    .join("\n");
}

function verifyTurbopackBuildCache() {
  const cacheDir = path.join(caseDir, ".turbopack", "persistent-cache");
  const outputDir = path.join(caseDir, "dist");
  const args = [
    "run",
    "--manifest-path",
    path.join(repoRoot, "crates/turbopack-cli/Cargo.toml"),
    "--",
    "build",
    "--dir",
    ".",
    "--root",
    ".",
    "--target",
    "node",
    "--no-minify",
    "--no-sourcemap",
    "--full-stats",
    "--persistent-caching",
    "--cache-dir",
    ".turbopack/persistent-cache",
    "src/entry.js",
  ];

  fs.rmSync(cacheDir, { force: true, recursive: true });
  fs.rmSync(outputDir, { force: true, recursive: true });
  const coldBuildOutput = runCommand("cargo", args, "turbopack: cold persistent build", {
    TURBO_ENGINE_IGNORE_DIRTY: "1",
  });
  const coldModuleBuildCache = summarizeTurbopackModuleBuildCache(coldBuildOutput);
  const coldCacheFiles = listFiles(cacheDir).length;
  if (coldCacheFiles === 0) {
    throw new Error("turbopack: expected persistent cache files after cold build");
  }

  fs.rmSync(outputDir, { force: true, recursive: true });
  const warmBuildOutput = runCommand("cargo", args, "turbopack: warm persistent build", {
    TURBO_ENGINE_IGNORE_DIRTY: "1",
  });
  const warmModuleBuildCache = summarizeTurbopackModuleBuildCache(warmBuildOutput);
  const warmCacheFiles = listFiles(cacheDir).length;
  if (warmCacheFiles === 0) {
    throw new Error("turbopack: expected persistent cache files after warm build");
  }

  const output = runCommand("node", [path.join(outputDir, "entry.entry.js")], "turbopack: execute");
  if (!output.includes(expectedBaseline) || !output.includes(expectedLazyReport)) {
    throw new Error(`turbopack: expected built entry output, got ${JSON.stringify(output)}`);
  }

  return {
    name: "turbopack",
    mode: "persistent build cache only; this case's top-level CLI has no dev/lazy command",
    cacheMetric: "TurboTasks ModuleAssetContext::process task cache hits",
    cold: {
      initial: {
        time: 0,
        modules: 0,
        cachedModules: 0,
        lazyModules: [],
        moduleBuildCache: coldModuleBuildCache,
      },
      activated: {
        time: 0,
        modules: 0,
        cachedModules: 0,
        lazyModules: [],
        moduleBuildCache: coldModuleBuildCache,
      },
      lazyKeys: 0,
    },
    warm: {
      initial: {
        time: 0,
        modules: 0,
        cachedModules: 0,
        lazyModules: [],
        moduleBuildCache: warmModuleBuildCache,
      },
      activated: {
        time: 0,
        modules: 0,
        cachedModules: 0,
        lazyModules: [],
        moduleBuildCache: warmModuleBuildCache,
      },
      lazyKeys: 0,
    },
    cacheFiles: warmCacheFiles,
  };
}

function printSummary(results) {
  console.log("\n== cache + lazy compilation comparison ==");
  for (const result of results) {
    const cold = result.cold.activated;
    const warm = result.warm.activated;
    console.log(
      [
        `${result.name}: ${result.mode}`,
        `  cache files: ${result.cacheFiles}`,
        `  lazy keys: cold ${result.cold.lazyKeys}, warm ${result.warm.lazyKeys}`,
        `  cache metric: ${result.cacheMetric}`,
        `  module build cache hit rate: cold ${formatHitRate(cold.moduleBuildCache)}, warm ${formatHitRate(warm.moduleBuildCache)}`,
        `  activated modules: cold ${cold.modules} (${cold.cachedModules} cached), warm ${warm.modules} (${warm.cachedModules} cached)`,
      ].join("\n")
    );
  }
}

async function main() {
  const results = [];
  results.push(
    await verifyLazyBundler(
      "webpack",
      runWebpackSession,
      path.join(caseDir, ".webpack-cache"),
      path.join(caseDir, "dist", "webpack")
    )
  );
  results.push(
    await verifyLazyBundler(
      "rspack",
      runRspackSession,
      path.join(caseDir, ".rspack-cache"),
      path.join(caseDir, "dist", "rspack")
    )
  );
  results.push(verifyTurbopackBuildCache());
  printSummary(results);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
