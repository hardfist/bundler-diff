const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert");

const caseDir = path.resolve(__dirname, "..");
const nodeDir = path.join(caseDir, "node-dist");
const browserDir = path.join(caseDir, "browser-dist");

function jsFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".js"))
    .sort();
}

function readAll(dir, files) {
  return files
    .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
    .join("\n\n");
}

const nodeFiles = jsFiles(nodeDir);
const browserFiles = jsFiles(browserDir);
const nodeOutput = readAll(nodeDir, nodeFiles);
const browserOutput = readAll(browserDir, browserFiles);
const nodeModuleChunks = nodeFiles.filter(
  (file) => file !== "[turbopack]_runtime.js" && file !== "entry.entry.js"
);
const browserModuleChunks = browserFiles.filter(
  (file) => !file.startsWith("turbopack-")
);
const browserModuleChunkSet = new Set(browserModuleChunks);
const commonModuleChunks = nodeModuleChunks.filter((file) => browserModuleChunkSet.has(file));
const nodeOnlyModuleChunks = nodeModuleChunks.filter((file) => !browserModuleChunkSet.has(file));
const browserOnlyModuleChunks = browserModuleChunks.filter(
  (file) => !nodeModuleChunks.includes(file)
);

assert(
  nodeFiles.includes("[turbopack]_runtime.js"),
  "node target emits a CommonJS runtime file"
);
assert(nodeFiles.includes("entry.entry.js"), "node target emits a CommonJS entry bootstrap");
assert(
  !browserFiles.includes("[turbopack]_runtime.js"),
  "browser target emits a browser runtime asset instead of [turbopack]_runtime.js"
);
assert(
  !browserFiles.includes("entry.entry.js"),
  "browser target emits a browser runtime/evaluate asset instead of a CommonJS entry bootstrap"
);

assert(
  nodeOutput.includes('require("./[turbopack]_runtime.js")'),
  "node target bootstraps through require()"
);
assert(
  nodeOutput.includes("module.exports = ["),
  "node target wraps module chunks as CommonJS arrays"
);
assert(
  browserOutput.includes('globalThis["TURBOPACK"]'),
  "browser target pushes chunks onto the global TURBOPACK queue"
);
assert(
  browserOutput.includes("document.currentScript"),
  "browser target tracks the current script for chunk loading"
);
assert(
  browserOutput.includes('"otherChunks"'),
  "browser target records entry metadata for dependent chunks"
);

console.log("browser target files:", browserFiles.join(", "));
console.log("node target files:", nodeFiles.join(", "));
console.log("common module chunk names:", commonModuleChunks.join(", ") || "<none>");
console.log("node-only module chunk names:", nodeOnlyModuleChunks.join(", ") || "<none>");
console.log("browser-only module chunk names:", browserOnlyModuleChunks.join(", ") || "<none>");
console.log("confirmed: browser and node target artifacts were compared");
