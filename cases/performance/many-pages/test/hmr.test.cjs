const assert = require("node:assert/strict");
const test = require("node:test");

const { replaceHmrDependencyRevision } = require("../scripts/lib/hmr.cjs");

test("replaceHmrDependencyRevision changes the dependency export", () => {
  const initial = `export const HMR_REVISION = "initial";
const payload_module_001 = Object.freeze(["payload"]);`;

  const updated = replaceHmrDependencyRevision(initial, "hmr-1");
  assert.match(updated, /export const HMR_REVISION = "hmr-1"/);
  assert.match(updated, /const payload_module_001 = Object\.freeze/);
});
