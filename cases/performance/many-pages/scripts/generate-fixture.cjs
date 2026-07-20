const path = require("node:path");

const {
  DEFAULT_FIXTURE_OPTIONS,
  generateFixture,
} = require("./lib/fixture.cjs");

const caseDir = path.resolve(__dirname, "..");
const metadata = generateFixture({
  outputDir: path.join(caseDir, ".generated"),
  routeCount: Number(process.env.ROUTES || DEFAULT_FIXTURE_OPTIONS.routeCount),
  modulesPerRoute: Number(
    process.env.MODULES_PER_ROUTE || DEFAULT_FIXTURE_OPTIONS.modulesPerRoute,
  ),
  payloadItems: Number(process.env.PAYLOAD_ITEMS || DEFAULT_FIXTURE_OPTIONS.payloadItems),
});

console.log(
  `generated ${metadata.routeCount} routes, ${metadata.totalModules} modules ` +
    `(${(metadata.routeLocalModuleRatio * 100).toFixed(2)}% route-local)`,
);
