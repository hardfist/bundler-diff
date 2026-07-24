const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildServerCommand,
  snapshotFailureFromOutput,
} = require("../scripts/lib/server.cjs");

const baseOptions = {
  bundler: "turbopack",
  caseDir: "/case",
  fixtureDir: "/fixture",
  port: 4321,
  turbopackBinary: "/bin/turbopack-cli",
};

test("Turbopack persistent cache can run without memory eviction", () => {
  assert.deepEqual(
    buildServerCommand({
      ...baseOptions,
      turbopackPersistentCache: true,
      turbopackMemoryEviction: "off",
      turbopackCacheDir: "/tmp/cache-off",
    }),
    {
      command: "/bin/turbopack-cli",
      args: [
        "dev",
        "--dir",
        "/fixture",
        "--root",
        "/fixture",
        "src/index.js",
        "--no-open",
        "--hostname",
        "127.0.0.1",
        "--port",
        "4321",
        "--persistent-caching",
        "--cache-dir",
        "/tmp/cache-off",
        "--turbopack-memory-eviction",
        "off",
      ],
    },
  );
});

test("Turbopack full memory eviction changes only the eviction mode", () => {
  const withoutEviction = buildServerCommand({
    ...baseOptions,
    turbopackPersistentCache: true,
    turbopackMemoryEviction: "off",
    turbopackCacheDir: "/tmp/cache",
  });
  const withEviction = buildServerCommand({
    ...baseOptions,
    turbopackPersistentCache: true,
    turbopackMemoryEviction: "full",
    turbopackCacheDir: "/tmp/cache",
  });

  assert.deepEqual(
    withEviction.args.slice(0, -1),
    withoutEviction.args.slice(0, -1),
  );
  assert.equal(withoutEviction.args.at(-1), "off");
  assert.equal(withEviction.args.at(-1), "full");
});

test("Turbopack memory eviction rejects a non-persistent server", () => {
  assert.throws(
    () =>
      buildServerCommand({
        ...baseOptions,
        turbopackPersistentCache: false,
        turbopackMemoryEviction: "full",
      }),
    /requires persistent caching/,
  );
});

test("Turbopack snapshot failures are promoted from runtime output", () => {
  assert.equal(
    snapshotFailureFromOutput("Persisting failed: disk full\n"),
    "Persisting failed: disk full",
  );
  assert.equal(
    snapshotFailureFromOutput("Compaction failed: corrupt database\n"),
    "Compaction failed: corrupt database",
  );
  assert.equal(snapshotFailureFromOutput("event - compilation 10ms\n"), undefined);
});
