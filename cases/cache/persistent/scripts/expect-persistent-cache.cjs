const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const caseDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(caseDir, "../../..");
const cacheDir = path.join(caseDir, ".turbopack", "persistent-cache");
const distDir = path.join(caseDir, "dist");
const manifestPath = path.join(repoRoot, "crates/turbopack-cli/Cargo.toml");

const buildArgs = [
  "run",
  "--manifest-path",
  manifestPath,
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
  "--persistent-caching",
  "--cache-dir",
  ".turbopack/persistent-cache",
  "src/entry.js",
];

function run(command, args, label) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: caseDir,
    encoding: "utf8",
    env: {
      ...process.env,
      TURBO_ENGINE_IGNORE_DIRTY: "1",
    },
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

fs.rmSync(cacheDir, { force: true, recursive: true });
fs.rmSync(distDir, { force: true, recursive: true });

const firstBuildOutput = run("cargo", buildArgs, "first build writes persistent cache");

if (firstBuildOutput.includes("File System Cache is disabled")) {
  console.error("Expected filesystem cache to stay enabled for the persistent cache example.");
  process.exit(1);
}

const firstCacheFiles = listFiles(cacheDir);
if (firstCacheFiles.length === 0) {
  console.error(`Expected persistent cache files under ${cacheDir}`);
  process.exit(1);
}

fs.rmSync(distDir, { force: true, recursive: true });
const secondBuildOutput = run("cargo", buildArgs, "second build reuses persistent cache directory");

if (secondBuildOutput.includes("File System Cache is disabled")) {
  console.error("Expected filesystem cache to stay enabled for the persistent cache example.");
  process.exit(1);
}

const secondCacheFiles = listFiles(cacheDir);
if (secondCacheFiles.length === 0) {
  console.error(`Expected persistent cache files to remain under ${cacheDir}`);
  process.exit(1);
}

const output = run("node", ["dist/entry.entry.js"], "execute built entry").trim();
const expected = "persistent cache case: 3 items, total 25";

if (output !== expected) {
  console.error(`Expected output ${JSON.stringify(expected)}, got ${JSON.stringify(output)}`);
  process.exit(1);
}

console.log(`confirmed: ${secondCacheFiles.length} persistent cache files in ${cacheDir}`);
