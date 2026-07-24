const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const caseDir = path.resolve(__dirname, "..");
const bundlers = [
  {
    name: "webpack",
    createCompiler: require("webpack"),
    configPath: path.join(caseDir, "webpack.config.cjs"),
    expectedNamespaces: [
      "client-development__compiler1__",
      "server-development__compiler2__",
    ],
  },
  {
    name: "rspack",
    createCompiler: require("@rspack/core").rspack,
    configPath: path.join(caseDir, "rspack.config.cjs"),
  },
];

function runBuild(bundler) {
  return new Promise((resolve, reject) => {
    delete require.cache[require.resolve(bundler.configPath)];
    const compiler = bundler.createCompiler(require(bundler.configPath));

    compiler.run((error, stats) => {
      const buildError =
        error ||
        (stats?.hasErrors()
          ? new Error(stats.toString({ all: false, errors: true, warnings: true }))
          : undefined);

      compiler.close((closeError) => {
        if (buildError || closeError) {
          reject(buildError || closeError);
        } else {
          resolve();
        }
      });
    });
  });
}

function listNamespaces(cacheDir) {
  return fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function executeEntry(bundler, compiler) {
  const entryPath = path.join(caseDir, "dist", bundler, compiler, "entry.js");
  const result = spawnSync(process.execPath, [entryPath], {
    cwd: caseDir,
    encoding: "utf8",
  });

  if (
    result.status !== 0 ||
    result.stdout.trim() !== "persistent cache multi compiler case"
  ) {
    throw new Error(`${bundler} ${compiler} entry failed:\n${result.stderr || result.stdout}`);
  }
}

async function verifyBundler(bundler) {
  const cacheDir = path.join(caseDir, `.${bundler.name}-cache`);
  const outputDir = path.join(caseDir, "dist", bundler.name);
  fs.rmSync(cacheDir, { force: true, recursive: true });
  fs.rmSync(outputDir, { force: true, recursive: true });

  await runBuild(bundler);
  fs.rmSync(outputDir, { force: true, recursive: true });
  await runBuild(bundler);

  executeEntry(bundler.name, "client");
  executeEntry(bundler.name, "server");

  const namespaces = listNamespaces(cacheDir);
  if (bundler.expectedNamespaces) {
    if (JSON.stringify(namespaces) !== JSON.stringify(bundler.expectedNamespaces)) {
      throw new Error(`${bundler.name}: unexpected cache namespaces: ${namespaces.join(", ")}`);
    }
  } else if (
    namespaces.length !== 2 ||
    !namespaces.every((name) => /^[0-9a-f]+$/.test(name))
  ) {
    throw new Error(`${bundler.name}: unexpected cache namespaces: ${namespaces.join(", ")}`);
  }

  return namespaces;
}

async function main() {
  console.log("\n== persistent cache + multi compiler comparison ==");
  for (const bundler of bundlers) {
    const namespaces = await verifyBundler(bundler);
    console.log(`${bundler.name}: ${namespaces.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
