const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const caseDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(caseDir, "../..");
const cargoManifest = path.join(repoDir, "crates/turbopack-cli/Cargo.toml");
const cargo = process.env.CARGO || "cargo";
function clean(dirName) {
  fs.rmSync(path.join(caseDir, dirName), { recursive: true, force: true });
}

function buildTarget(target) {
  clean("dist");
  clean(`${target}-dist`);

  const cargoArgs = [
    "run",
    "--manifest-path",
    cargoManifest,
    "--",
    "build",
    "--dir",
    ".",
    "--root",
    ".",
    "--target",
    target,
    "--no-minify",
    "--no-sourcemap",
    "src/entry.js",
  ];

  console.log(`\n==> Building ${target} target`);
  const result = spawnSync(cargo, cargoArgs, {
    cwd: caseDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const distDir = path.join(caseDir, "dist");
  if (!fs.existsSync(distDir)) {
    console.error(`Expected ${distDir} to be created.`);
    process.exit(1);
  }

  fs.renameSync(distDir, path.join(caseDir, `${target}-dist`));
}

buildTarget("node");
buildTarget("browser");
