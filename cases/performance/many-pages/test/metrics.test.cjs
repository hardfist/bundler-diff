const assert = require("node:assert/strict");
const test = require("node:test");

const {
  descendantsOf,
  parsePsTable,
  summarizeSamples,
} = require("../scripts/lib/metrics.cjs");

test("summarizeSamples reports stable latency statistics", () => {
  assert.deepEqual(summarizeSamples([20, 10, 40, 30, 50]), {
    count: 5,
    min: 10,
    median: 30,
    p95: 50,
    max: 50,
    mean: 30,
  });
});

test("parsePsTable and descendantsOf include the whole server process tree", () => {
  const processes = parsePsTable(`
  10  1  1024 node server.js
  11 10  2048 worker
  12 11  4096 nested worker
  99  1  8192 unrelated
`);

  assert.deepEqual(
    descendantsOf(processes, 10).map((process) => process.pid),
    [10, 11, 12],
  );
  assert.equal(
    descendantsOf(processes, 10).reduce((sum, process) => sum + process.rssKb, 0),
    7168,
  );
});
