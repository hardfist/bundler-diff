const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const caseDir = path.resolve(__dirname, "..");

const bundlers = [
  {
    name: "turbopack",
    buildScript: "build:turbopack",
    cacheDir: path.join(caseDir, ".turbopack", "persistent-cache"),
    outputDir: path.join(caseDir, "dist"),
    entryPath: path.join(caseDir, "dist", "entry.entry.js"),
    disabledCacheText: "File System Cache is disabled",
  },
  {
    name: "webpack",
    buildScript: "build:webpack",
    cacheDir: path.join(caseDir, ".webpack-cache"),
    outputDir: path.join(caseDir, "dist", "webpack"),
    entryPath: path.join(caseDir, "dist", "webpack", "entry.js"),
  },
  {
    name: "rspack",
    buildScript: "build:rspack",
    cacheDir: path.join(caseDir, ".rspack-cache"),
    outputDir: path.join(caseDir, "dist", "rspack"),
    entryPath: path.join(caseDir, "dist", "rspack", "entry.js"),
  },
];

function run(command, args, label) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: caseDir,
    encoding: "utf8",
  });

  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");

  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }

  return `${result.stdout || ""}${result.stderr || ""}`;
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

function expectCacheEnabled(output, bundler) {
  if (!bundler.disabledCacheText) {
    return;
  }

  if (output.includes(bundler.disabledCacheText)) {
    console.error(`Expected ${bundler.name} filesystem cache to stay enabled.`);
    process.exit(1);
  }
}

function verifyBundler(bundler) {
  fs.rmSync(bundler.cacheDir, { force: true, recursive: true });
  fs.rmSync(bundler.outputDir, { force: true, recursive: true });

  const firstOutput = run(
    "pnpm",
    ["run", bundler.buildScript],
    `${bundler.name}: first build writes persistent cache`
  );
  expectCacheEnabled(firstOutput, bundler);

  const firstCacheFiles = listFiles(bundler.cacheDir);
  if (firstCacheFiles.length === 0) {
    console.error(`Expected ${bundler.name} persistent cache files under ${bundler.cacheDir}`);
    process.exit(1);
  }

  fs.rmSync(bundler.outputDir, { force: true, recursive: true });
  const secondOutput = run(
    "pnpm",
    ["run", bundler.buildScript],
    `${bundler.name}: second build reuses persistent cache directory`
  );
  expectCacheEnabled(secondOutput, bundler);

  const secondCacheFiles = listFiles(bundler.cacheDir);
  if (secondCacheFiles.length === 0) {
    console.error(
      `Expected ${bundler.name} persistent cache files to remain under ${bundler.cacheDir}`
    );
    process.exit(1);
  }

  const entry = path.relative(caseDir, bundler.entryPath);
  const output = run("node", [entry], `${bundler.name}: execute built entry`).trim();
  const expected = "persistent cache case: 3 items, total 25";

  if (output !== expected) {
    console.error(`Expected output ${JSON.stringify(expected)}, got ${JSON.stringify(output)}`);
    process.exit(1);
  }

  console.log(
    `confirmed: ${bundler.name} wrote ${secondCacheFiles.length} persistent cache files in ${bundler.cacheDir}`
  );
}

for (const bundler of bundlers) {
  verifyBundler(bundler);
}
