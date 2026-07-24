const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const caseDir = path.resolve(__dirname, "..");

const bundlers = [
  {
    name: "webpack",
    createCompiler: require("webpack"),
    configPath: path.join(caseDir, "webpack.config.cjs"),
    cacheDir: path.join(caseDir, ".webpack-cache"),
    inspectLayout(compiler) {
      return compiler.compilers.map((child) => ({
        compiler: child.name,
        cacheName: child.options.cache.name,
        cacheLocation: child.options.cache.cacheLocation,
      }));
    },
  },
  {
    name: "rspack",
    createCompiler: require("@rspack/core").rspack,
    configPath: path.join(caseDir, "rspack.config.cjs"),
    cacheDir: path.join(caseDir, ".rspack-cache"),
    inspectLayout(compiler) {
      return compiler.compilers.map((child) => ({
        compiler: child.name,
        storageDirectory: child.options.cache.storage.directory,
      }));
    },
  },
];

function loadConfig(configPath) {
  delete require.cache[require.resolve(configPath)];
  return require(configPath);
}

function runCompiler(compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      if (error) {
        reject(error);
      } else if (!stats) {
        reject(new Error("Expected multi compiler stats"));
      } else {
        resolve(stats);
      }
    });
  });
}

function closeCompiler(compiler) {
  return new Promise((resolve, reject) => {
    compiler.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function summarizeStats(stats) {
  return stats.stats.map((childStats) => {
    const json = childStats.toJson({
      all: false,
      cached: true,
      cachedModules: true,
      errors: true,
      modules: true,
      warnings: true,
    });
    const modules = json.modules || [];

    return {
      name: childStats.compilation.name,
      modules: modules.length,
      cachedModules: modules.filter((module) => module.cached).length,
      unbuiltModules: modules.filter((module) => module.built === false).length,
    };
  });
}

async function runSession(bundler, session) {
  const compiler = bundler.createCompiler(loadConfig(bundler.configPath));
  const layout = bundler.inspectLayout(compiler);
  let stats;

  try {
    stats = await runCompiler(compiler);
  } finally {
    await closeCompiler(compiler);
  }

  if (stats.hasErrors()) {
    throw new Error(
      `${bundler.name} ${session} build failed:\n${stats.toString({
        all: false,
        errors: true,
        warnings: true,
      })}`
    );
  }

  return {
    layout,
    stats: summarizeStats(stats),
  };
}

function readTrace(traceFile) {
  if (!fs.existsSync(traceFile)) {
    return [];
  }

  return fs
    .readFileSync(traceFile, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function verifyTrace(name, records) {
  const expected = new Map([
    ["client", ["src/client.js", "src/shared.js"]],
    ["server", ["src/server.js", "src/shared.js"]],
  ]);

  if (records.length !== 4) {
    throw new Error(`${name}: expected 4 cold loader runs and no warm runs, got ${records.length}`);
  }

  for (const [compiler, expectedResources] of expected) {
    const resources = records
      .filter((record) => record.compiler === compiler)
      .map((record) => record.resource)
      .sort();

    if (JSON.stringify(resources) !== JSON.stringify(expectedResources)) {
      throw new Error(
        `${name}: expected ${compiler} loader runs for ${expectedResources.join(
          ", "
        )}, got ${resources.join(", ")}`
      );
    }
  }
}

function executeEntry(bundler, compiler, expected) {
  const entryPath = path.join(caseDir, "dist", bundler, compiler, "entry.js");
  const result = spawnSync(process.execPath, [entryPath], {
    cwd: caseDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `${bundler} ${compiler} entry failed with exit code ${result.status}:\n${
        result.stderr || result.stdout
      }`
    );
  }

  if (result.stdout.trim() !== expected) {
    throw new Error(
      `${bundler} ${compiler}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(
        result.stdout.trim()
      )}`
    );
  }
}

function verifyWebpackDifference(result, cacheDir) {
  const expected = [
    {
      compiler: "client",
      cacheName: "client-development__compiler1__",
      cacheLocation: path.join(cacheDir, "client-development__compiler1__"),
    },
    {
      compiler: "server",
      cacheName: "server-development__compiler2__",
      cacheLocation: path.join(cacheDir, "server-development__compiler2__"),
    },
  ];

  if (JSON.stringify(result.warm.layout) !== JSON.stringify(expected)) {
    throw new Error(
      `webpack: unexpected normalized multi compiler cache layout:\n${JSON.stringify(
        result.warm.layout,
        null,
        2
      )}`
    );
  }

  if (!result.warm.stats.every((child) => child.cachedModules > 0)) {
    throw new Error(
      `webpack: expected warm stats to contain cached module containers:\n${JSON.stringify(
        result.warm.stats,
        null,
        2
      )}`
    );
  }
}

function verifyRspackDifference(result, cacheDir) {
  const storageDirectories = new Set(
    result.warm.layout.map((child) => child.storageDirectory)
  );
  if (storageDirectories.size !== 1 || !storageDirectories.has(cacheDir)) {
    throw new Error(
      `rspack: expected both child compilers to retain one storage directory:\n${JSON.stringify(
        result.warm.layout,
        null,
        2
      )}`
    );
  }

  const namespaces = fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (namespaces.length !== 2 || !namespaces.every((name) => /^[0-9a-f]+$/.test(name))) {
    throw new Error(
      `rspack: expected two configuration-hash cache namespaces, got ${namespaces.join(", ")}`
    );
  }

  if (
    !result.warm.stats.every(
      (child) => child.cachedModules === 0 && child.unbuiltModules > 0
    )
  ) {
    throw new Error(
      `rspack: expected restored modules to be unbuilt but not marked cached:\n${JSON.stringify(
        result.warm.stats,
        null,
        2
      )}`
    );
  }

  result.namespaces = namespaces;
}

async function verifyBundler(bundler) {
  const outputDir = path.join(caseDir, "dist", bundler.name);
  const traceFile = path.join(bundler.cacheDir, "loader-runs.jsonl");
  fs.rmSync(bundler.cacheDir, { force: true, recursive: true });
  fs.rmSync(outputDir, { force: true, recursive: true });

  const cold = await runSession(bundler, "cold");
  const coldTraceCount = readTrace(traceFile).length;
  if (coldTraceCount !== 4) {
    throw new Error(`${bundler.name}: expected 4 loader runs after cold build, got ${coldTraceCount}`);
  }

  fs.rmSync(outputDir, { force: true, recursive: true });
  const warm = await runSession(bundler, "warm");
  const records = readTrace(traceFile);
  verifyTrace(bundler.name, records);

  executeEntry(
    bundler.name,
    "client",
    "multi compiler client: persistent cache restored"
  );
  executeEntry(
    bundler.name,
    "server",
    "multi compiler server: persistent cache restored"
  );

  const result = { cold, warm };
  if (bundler.name === "webpack") {
    verifyWebpackDifference(result, bundler.cacheDir);
  } else {
    verifyRspackDifference(result, bundler.cacheDir);
  }

  return result;
}

function printSummary(results) {
  console.log("\n== persistent cache + multi compiler comparison ==");
  console.log("webpack:");
  for (const child of results.webpack.warm.layout) {
    console.log(`  ${child.compiler}: ${path.relative(caseDir, child.cacheLocation)}`);
  }
  console.log(
    `  warm stats cached modules: ${results.webpack.warm.stats
      .map((child) => `${child.name}=${child.cachedModules}`)
      .join(", ")}`
  );

  console.log("rspack:");
  console.log(
    `  shared storage: ${path.relative(
      caseDir,
      results.rspack.warm.layout[0].storageDirectory
    )}`
  );
  console.log(`  backend namespaces: ${results.rspack.namespaces.join(", ")}`);
  console.log(
    `  warm stats cached/unbuilt modules: ${results.rspack.warm.stats
      .map((child) => `${child.name}=${child.cachedModules}/${child.unbuiltModules}`)
      .join(", ")}`
  );
  console.log("confirmed: both bundlers restored all four child-compiler modules");
}

async function main() {
  const results = {};
  for (const bundler of bundlers) {
    results[bundler.name] = await verifyBundler(bundler);
  }
  printSummary(results);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
