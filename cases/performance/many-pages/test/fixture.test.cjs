const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { generateFixture } = require("../scripts/lib/fixture.cjs");

test("generateFixture creates isolated route graphs and benchmark metadata", (t) => {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "many-pages-fixture-"));
  const outputDir = path.join(parentDir, "generated");
  t.after(() => fs.rmSync(parentDir, { recursive: true, force: true }));

  const metadata = generateFixture({
    outputDir,
    routeCount: 3,
    modulesPerRoute: 2,
    payloadItems: 4,
  });

  assert.deepEqual(metadata, {
    routeCount: 3,
    modulesPerRoute: 2,
    payloadItems: 4,
    sharedModules: 2,
    routeLocalModules: 9,
    totalModules: 11,
    routeLocalModuleRatio: 9 / 11,
  });

  const routesSource = fs.readFileSync(path.join(outputDir, "src/routes.js"), "utf8");
  assert.match(routesSource, /route-001/);
  assert.match(routesSource, /route-003/);
  assert.equal((routesSource.match(/import\(/g) || []).length, 3);

  const firstPage = fs.readFileSync(
    path.join(outputDir, "src/pages/route-001/page.js"),
    "utf8",
  );
  const firstLeaf = fs.readFileSync(
    path.join(outputDir, "src/pages/route-001/module-001.js"),
    "utf8",
  );
  const secondLeaf = fs.readFileSync(
    path.join(outputDir, "src/pages/route-002/module-001.js"),
    "utf8",
  );
  assert.match(
    firstPage,
    /import \{ HMR_REVISION, value_module_001 \} from "\.\/module-001\.js"/,
  );
  assert.match(firstPage, /revision: HMR_REVISION/);
  assert.doesNotMatch(firstPage, /const REVISION =/);
  assert.match(
    firstPage,
    /import\.meta\.turbopackHot\.accept\("\.\/module-001\.js", \(\) => \{/,
  );
  assert.match(
    firstPage,
    /import\.meta\.webpackHot\.accept\("\.\/module-001\.js", \(\) => \{/,
  );
  assert.match(firstLeaf, /export const HMR_REVISION = "initial"/);
  assert.match(firstLeaf, /route-1-module-1-payload-0/);
  assert.doesNotMatch(secondLeaf, /route-1-module-1-payload-0/);
  assert.ok(fs.existsSync(path.join(outputDir, "public/index.html")));
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(outputDir, "fixture.json"), "utf8")),
    metadata,
  );
});

test("generateFixture defaults to 300 leaf modules per route", (t) => {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "many-pages-default-"));
  const outputDir = path.join(parentDir, "generated");
  t.after(() => fs.rmSync(parentDir, { recursive: true, force: true }));

  const metadata = generateFixture({
    outputDir,
    routeCount: 1,
    payloadItems: 1,
  });

  assert.equal(metadata.modulesPerRoute, 300);
  assert.equal(metadata.routeLocalModules, 301);
  assert.equal(metadata.totalModules, 303);
  assert.ok(fs.existsSync(path.join(outputDir, "src/pages/route-001/module-300.js")));
});

test("generateFixture rejects invalid dimensions", () => {
  assert.throws(
    () =>
      generateFixture({
        outputDir: "/tmp/not-created",
        routeCount: 0,
        modulesPerRoute: 1,
        payloadItems: 1,
      }),
    /routeCount must be a positive integer/,
  );
});
