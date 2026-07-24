const assert = require("node:assert/strict");
const test = require("node:test");

const {
  descendantsOf,
  parsePhysicalFootprintBytes,
  parseProcessTable,
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

test("parsePhysicalFootprintBytes prefers the de-duplicated process-tree summary", () => {
  assert.equal(
    parsePhysicalFootprintBytes(`
Auxiliary data:
    phys_footprint: 7487944 B
Summary Footprint: 13026576 B
`),
    13026576,
  );
});

test("parsePhysicalFootprintBytes supports a server with no child processes", () => {
  assert.equal(
    parsePhysicalFootprintBytes(`
sleep [47320]: 64-bit    Footprint: 884928 B (16384 bytes per page)
Auxiliary data:
    phys_footprint: 901312 B
    phys_footprint_peak: 917696 B
`),
    901312,
  );
});

test("parseProcessTable and descendantsOf identify the whole server process tree", () => {
  const processes = parseProcessTable(`
  10  1 node server.js
  11 10 worker
  12 11 nested worker
  99  1 unrelated
`);

  assert.deepEqual(
    descendantsOf(processes, 10).map((process) => process.pid),
    [10, 11, 12],
  );
  assert.deepEqual(processes[0], {
    pid: 10,
    parentPid: 1,
    command: "node server.js",
  });
});
