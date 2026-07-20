const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const { ChromeBrowser, getFreePort } = require("./lib/browser.cjs");
const {
  DEFAULT_FIXTURE_OPTIONS,
  generateFixture,
  routeName,
} = require("./lib/fixture.cjs");
const {
  delay,
  sampleProcessTreePhysicalFootprint,
  summarizeSamples,
} = require("./lib/metrics.cjs");
const { ensureTurbopackBinary, startServer } = require("./lib/server.cjs");

const caseDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(caseDir, "../../..");
const fixtureDir = path.join(caseDir, ".generated");
const allBundlers = ["turbopack", "webpack", "rspack"];
const activeServers = new Set();
let activeBrowser;
let shuttingDown = false;

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled([...activeServers].map((server) => server.stop()));
  if (activeBrowser) await activeBrowser.close().catch(() => {});
  process.exit(exitCode);
}

process.once("SIGINT", () => void shutdown(130));
process.once("SIGTERM", () => void shutdown(143));

function usage() {
  return `Usage: pnpm benchmark -- [options]

Options:
  --bundlers=turbopack,webpack,rspack
  --routes=100
  --modules-per-route=30
  --payload-items=12
  --hmr-runs=5
  --hmr-warmup=1
  --settle-ms=1000
  --route-timeout-ms=60000
  --turbopack-binary=/absolute/path/to/turbopack-cli
  --turbopack-profile=release|debug
  --output=/absolute/path/to/results.json
  --skip-memory
  --skip-hmr
`;
}

function positiveInteger(name, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, received ${value}`);
  }
  return parsed;
}

function nonNegativeInteger(name, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, received ${value}`);
  }
  return parsed;
}

function parseOptions(argv) {
  const values = new Map();
  const flags = new Set();
  for (const argument of argv) {
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      flags.add("help");
      continue;
    }
    if (argument === "--skip-memory" || argument === "--skip-hmr") {
      flags.add(argument.slice(2));
      continue;
    }
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match) throw new Error(`unknown argument: ${argument}`);
    values.set(match[1], match[2]);
  }

  const bundlers = (values.get("bundlers") || allBundlers.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (bundlers.length === 0 || bundlers.some((bundler) => !allBundlers.includes(bundler))) {
    throw new Error(`bundlers must be a subset of ${allBundlers.join(", ")}`);
  }

  return {
    help: flags.has("help"),
    bundlers,
    routeCount: positiveInteger(
      "routes",
      values.get("routes") || DEFAULT_FIXTURE_OPTIONS.routeCount,
    ),
    modulesPerRoute: positiveInteger(
      "modules-per-route",
      values.get("modules-per-route") || DEFAULT_FIXTURE_OPTIONS.modulesPerRoute,
    ),
    payloadItems: positiveInteger(
      "payload-items",
      values.get("payload-items") || DEFAULT_FIXTURE_OPTIONS.payloadItems,
    ),
    hmrRuns: positiveInteger("hmr-runs", values.get("hmr-runs") || 5),
    hmrWarmup: nonNegativeInteger("hmr-warmup", values.get("hmr-warmup") || 1),
    settleMs: nonNegativeInteger("settle-ms", values.get("settle-ms") || 1000),
    routeTimeoutMs: positiveInteger(
      "route-timeout-ms",
      values.get("route-timeout-ms") || 60000,
    ),
    turbopackBinary: values.get("turbopack-binary") || process.env.TURBOPACK_CLI,
    turbopackProfile: values.get("turbopack-profile") || "release",
    output: values.get("output"),
    measureMemory: !flags.has("skip-memory"),
    measureHmr: !flags.has("skip-hmr"),
  };
}

function packageVersion(packageName) {
  return require(`${packageName}/package.json`).version;
}

function gitOutput(args, cwd = repoRoot) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function cleanupBundlerArtifacts() {
  for (const directory of [".turbopack", ".webpack-dist", ".rspack-dist"]) {
    fs.rmSync(path.join(fixtureDir, directory), { recursive: true, force: true });
  }
}

async function openBenchmarkPage(browser, bundler, serverUrl, timeoutMs) {
  const page = await browser.newPage();
  const entryUrl = bundler === "turbopack" ? `${serverUrl}/` : `${serverUrl}/index.html`;
  try {
    await page.navigate(entryUrl);
    await page.waitFor("globalThis.__BENCH_READY__ === true", {
      timeoutMs,
      description: `${bundler} benchmark entry to become ready`,
    });
    page.benchmarkEntryUrl = entryUrl;
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
}

async function navigateRoute(page, route, timeoutMs, reloadEntry = false) {
  if (reloadEntry) {
    await page.navigate(page.benchmarkEntryUrl);
    await page.waitFor("globalThis.__BENCH_READY__ === true", {
      timeoutMs,
      description: "benchmark entry to reload",
    });
  }
  await page.evaluate(`globalThis.__navigate(${route})`, { timeoutMs });
  await page.waitFor(
    `globalThis.__BENCH_RENDERED_ROUTE__ === ${route} && ` +
      `location.pathname === "/${routeName(route).replace("route-", "route/")}"`,
    { timeoutMs, description: `route ${route} to render` },
  );
}

async function visitRoutes(page, routeCount, timeoutMs, bundler) {
  for (let route = 1; route <= routeCount; route += 1) {
    await navigateRoute(page, route, timeoutMs, route > 1);
    if (routeCount >= 20 && (route % 10 === 0 || route === routeCount)) {
      process.stdout.write(`\r    ${bundler}: visited ${route}/${routeCount} routes`);
    }
  }
  if (routeCount >= 20) process.stdout.write("\n");
}

function physicalFootprintPoint(sample) {
  return {
    physicalFootprintMiB: sample.summaryBytes.median / (1024 * 1024),
    samplesMiB: sample.samplesBytes.map((value) => value / (1024 * 1024)),
    processCount: sample.processes.length,
    processes: sample.processes.map((item) => ({
      pid: item.pid,
      parentPid: item.parentPid,
      command: item.command,
    })),
  };
}

async function withServer(options, run) {
  cleanupBundlerArtifacts();
  const port = await getFreePort();
  const server = await startServer({ ...options, caseDir, fixtureDir, port });
  activeServers.add(server);
  let page;
  try {
    page = await openBenchmarkPage(
      options.browser,
      options.bundler,
      server.url,
      options.routeTimeoutMs,
    );
    return await run({ page, server });
  } finally {
    await page?.close().catch(() => {});
    await server.stop();
    activeServers.delete(server);
  }
}

async function measureMemory(options) {
  return withServer(options, async ({ page, server }) => {
    await navigateRoute(page, 1, options.routeTimeoutMs);
    await delay(options.settleMs);
    const afterOneSample = await sampleProcessTreePhysicalFootprint(server.child.pid);

    if (options.routeCount > 1) {
      for (let route = 2; route <= options.routeCount; route += 1) {
        await navigateRoute(page, route, options.routeTimeoutMs, true);
        if (options.routeCount >= 20 && (route % 10 === 0 || route === options.routeCount)) {
          process.stdout.write(
            `\r    ${options.bundler}: memory visit ${route}/${options.routeCount}`,
          );
        }
      }
      if (options.routeCount >= 20) process.stdout.write("\n");
      // Hold the active route constant across both memory points. This makes
      // compiled-route history, rather than the current page, the variable.
      await navigateRoute(page, 1, options.routeTimeoutMs, true);
    }
    await delay(options.settleMs);
    const afterAllSample = await sampleProcessTreePhysicalFootprint(server.child.pid);
    const afterOne = physicalFootprintPoint(afterOneSample);
    const afterAll = physicalFootprintPoint(afterAllSample);
    return {
      metric: "physical-footprint",
      unit: "MiB",
      afterOne,
      afterAll,
      activeRoute: 1,
      deltaMiB: afterAll.physicalFootprintMiB - afterOne.physicalFootprintMiB,
      deltaPercent:
        afterOne.physicalFootprintMiB === 0
          ? null
          : ((afterAll.physicalFootprintMiB - afterOne.physicalFootprintMiB) /
              afterOne.physicalFootprintMiB) *
            100,
    };
  });
}

function replaceRevision(source, revision) {
  const next = source.replace(
    /const REVISION = "[^"]+";/,
    `const REVISION = ${JSON.stringify(revision)};`,
  );
  if (next === source) throw new Error("failed to locate the HMR revision marker");
  return next;
}

async function measureHmrState(options, visitedRoutes) {
  return withServer(options, async ({ page }) => {
    await visitRoutes(page, visitedRoutes, options.routeTimeoutMs, options.bundler);
    if (visitedRoutes > 1) {
      // Edit the same route in both scenarios so route identity cannot
      // masquerade as a route-count HMR effect.
      await navigateRoute(page, 1, options.routeTimeoutMs, true);
    }
    await delay(options.settleMs);

    const pageFile = path.join(
      fixtureDir,
      "src/pages",
      routeName(1),
      "page.js",
    );
    const original = fs.readFileSync(pageFile, "utf8");
    let current = original;
    const documentToken = await page.evaluate("globalThis.__BENCH_DOCUMENT_TOKEN__");
    const samplesMs = [];
    const iterations = options.hmrWarmup + options.hmrRuns;

    try {
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const revision = `hmr-${visitedRoutes}-${iteration}-${Date.now()}`;
        current = replaceRevision(current, revision);
        const start = performance.now();
        fs.writeFileSync(pageFile, current);
        await page.waitFor(
          `globalThis.__BENCH_HMR_REVISION__ === ${JSON.stringify(revision)}`,
          {
            timeoutMs: options.routeTimeoutMs,
            intervalMs: 5,
            description: `${options.bundler} HMR revision ${revision}`,
          },
        );
        const durationMs = performance.now() - start;
        const currentToken = await page.evaluate("globalThis.__BENCH_DOCUMENT_TOKEN__");
        if (currentToken !== documentToken) {
          throw new Error(`${options.bundler} performed a full page reload instead of HMR`);
        }
        if (iteration >= options.hmrWarmup) samplesMs.push(durationMs);
      }
    } finally {
      fs.writeFileSync(pageFile, original);
    }

    return {
      visitedRoutes,
      editedRoute: 1,
      warmupRuns: options.hmrWarmup,
      samplesMs,
      summaryMs: summarizeSamples(samplesMs),
      fullReloads: 0,
    };
  });
}

async function benchmarkBundler(options) {
  console.log(`\n${options.bundler}`);
  const result = {};
  if (options.measureMemory) {
    console.log("  measuring process-tree Physical footprint after 1 and all routes...");
    result.memory = await measureMemory(options);
  }
  if (options.measureHmr) {
    console.log("  measuring HMR after 1 visited route...");
    result.hmrAfterOne = await measureHmrState(options, 1);
    console.log(`  measuring HMR after ${options.routeCount} visited routes...`);
    result.hmrAfterAll = await measureHmrState(options, options.routeCount);
    const afterOneMedian = result.hmrAfterOne.summaryMs.median;
    const afterAllMedian = result.hmrAfterAll.summaryMs.median;
    result.hmrDelta = {
      medianMs: afterAllMedian - afterOneMedian,
      medianPercent:
        afterOneMedian === 0 ? null : ((afterAllMedian - afterOneMedian) / afterOneMedian) * 100,
    };
  }
  return result;
}

function formatNumber(value, digits = 1) {
  return value === undefined || value === null ? "n/a" : value.toFixed(digits);
}

function printSummary(results, routeCount) {
  console.log("\nSummary");
  console.log(
    "bundler    Footprint@1 MiB  Footprint@all MiB  PF delta MiB  PF delta %  HMR@1 ms  HMR@all ms  HMR delta ms  HMR delta %",
  );
  for (const [bundler, result] of Object.entries(results)) {
    console.log(
      [
        bundler.padEnd(10),
        formatNumber(result.memory?.afterOne.physicalFootprintMiB).padStart(15),
        formatNumber(result.memory?.afterAll.physicalFootprintMiB).padStart(17),
        formatNumber(result.memory?.deltaMiB).padStart(12),
        formatNumber(result.memory?.deltaPercent).padStart(11),
        formatNumber(result.hmrAfterOne?.summaryMs.median).padStart(8),
        formatNumber(result.hmrAfterAll?.summaryMs.median).padStart(10),
        formatNumber(result.hmrDelta?.medianMs).padStart(12),
        formatNumber(result.hmrDelta?.medianPercent).padStart(11),
      ].join("  "),
    );
  }
  console.log(
    `Footprint@all and HMR@all are measured after ${routeCount} cumulative route visits.`,
  );
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (!options.measureMemory && !options.measureHmr) {
    throw new Error("nothing to measure: both memory and HMR are disabled");
  }

  const fixture = generateFixture({
    outputDir: fixtureDir,
    routeCount: options.routeCount,
    modulesPerRoute: options.modulesPerRoute,
    payloadItems: options.payloadItems,
  });
  console.log(
    `Fixture: ${fixture.routeCount} routes, ${fixture.totalModules} modules, ` +
      `${(fixture.routeLocalModuleRatio * 100).toFixed(2)}% route-local`,
  );

  let turbopackBinary;
  if (options.bundlers.includes("turbopack")) {
    console.log(`Preparing Turbopack (${options.turbopackProfile})...`);
    turbopackBinary = await ensureTurbopackBinary({
      repoRoot,
      explicitBinary: options.turbopackBinary,
      profile: options.turbopackProfile,
    });
  }

  const browser = await ChromeBrowser.launch();
  activeBrowser = browser;
  const results = {};
  try {
    for (const bundler of options.bundlers) {
      results[bundler] = await benchmarkBundler({
        ...options,
        bundler,
        browser,
        turbopackBinary,
      });
    }
  } finally {
    await browser.close();
    activeBrowser = undefined;
  }

  const output = options.output
    ? path.resolve(options.output)
    : path.join(caseDir, "results/latest.json");
  const document = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    repositoryCommit: gitOutput(["rev-parse", "HEAD"]),
    turbopackCommit: gitOutput(["rev-parse", "HEAD"], path.join(repoRoot, "third_party/turbopack")),
    platform: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      chrome: browser.version,
    },
    versions: {
      webpack: packageVersion("webpack"),
      webpackDevServer: packageVersion("webpack-dev-server"),
      rspack: packageVersion("@rspack/core"),
      rspackDevServer: packageVersion("@rspack/dev-server"),
      turbopackBinary: turbopackBinary || null,
    },
    options: {
      bundlers: options.bundlers,
      routeCount: options.routeCount,
      modulesPerRoute: options.modulesPerRoute,
      payloadItems: options.payloadItems,
      hmrRuns: options.hmrRuns,
      hmrWarmup: options.hmrWarmup,
      settleMs: options.settleMs,
      routeTimeoutMs: options.routeTimeoutMs,
      measureMemory: options.measureMemory,
      measureHmr: options.measureHmr,
    },
    fixture,
    results,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  printSummary(results, options.routeCount);
  console.log(`Results: ${output}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
