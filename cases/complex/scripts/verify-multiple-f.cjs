const fs = require("fs");
const path = require("path");

const runtimePath = path.join(__dirname, "..", "rspack-multi-f-dist", "runtime.js");
const runtime = fs.readFileSync(runtimePath, "utf8");

const handlers = [...runtime.matchAll(/__webpack_require__\.f\.([A-Za-z_$][\w$]*)\s*=/g)]
  .map((match) => match[1])
  .sort();

const uniqueHandlers = [...new Set(handlers)];
const expected = ["css", "j"];
const missing = expected.filter((name) => !uniqueHandlers.includes(name));

if (missing.length) {
  console.error(`Expected multiple __webpack_require__.f handlers; missing: ${missing.join(", ")}`);
  console.error(`Found handlers: ${uniqueHandlers.join(", ") || "<none>"}`);
  process.exit(1);
}

const cssAsset = path.join(__dirname, "..", "rspack-multi-f-dist", "src_styled-feature_js.css");
const jsAsset = path.join(__dirname, "..", "rspack-multi-f-dist", "src_styled-feature_js.js");
for (const file of [cssAsset, jsAsset]) {
  if (!fs.existsSync(file)) {
    console.error(`Expected emitted lazy asset missing: ${path.relative(process.cwd(), file)}`);
    process.exit(1);
  }
}

console.log(`verified __webpack_require__.f handlers: ${uniqueHandlers.join(", ")}`);
console.log("verified lazy JS and CSS assets exist");
