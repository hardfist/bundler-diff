const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_FIXTURE_OPTIONS = Object.freeze({
  routeCount: 100,
  modulesPerRoute: 30,
  payloadItems: 12,
});

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer, received ${value}`);
  }
}

function routeName(routeNumber) {
  return `route-${String(routeNumber).padStart(3, "0")}`;
}

function moduleName(moduleNumber) {
  return `module-${String(moduleNumber).padStart(3, "0")}`;
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function createIndexSource(routeCount) {
  return `import { routeLoaders } from "./routes.js";

const documentToken = Math.random().toString(36).slice(2);
let navigationSequence = 0;

const base = document.createElement("base");
base.href = "/";
document.head.prepend(base);

function getRoot() {
  let root = document.querySelector("#app");
  if (!root) {
    root = document.createElement("main");
    root.id = "app";
    document.body.append(root);
  }
  return root;
}

globalThis.__BENCH_DOCUMENT_TOKEN__ = documentToken;
globalThis.__BENCH_ROUTE_COUNT__ = ${routeCount};
globalThis.__BENCH_RENDER__ = ({ route, revision, checksum }) => {
  getRoot().innerHTML = [
    "<h1>Route " + String(route).padStart(3, "0") + "</h1>",
    '<p data-revision="' + revision + '">revision: ' + revision + "</p>",
    '<p data-checksum="' + checksum + '">checksum: ' + checksum + "</p>",
  ].join("");
  globalThis.__BENCH_RENDERED_ROUTE__ = route;
  globalThis.__BENCH_HMR_REVISION__ = revision;
};

globalThis.__navigate = async (route) => {
  if (!Number.isInteger(route) || route < 1 || route > routeLoaders.length) {
    throw new RangeError("unknown route: " + route);
  }

  const sequence = ++navigationSequence;
  const page = await routeLoaders[route - 1]();
  if (sequence !== navigationSequence) return;

  globalThis.__ACTIVE_ROUTE__ = route;
  history.pushState({ route }, "", "/route/" + String(route).padStart(3, "0"));
  page.renderPage();
};

globalThis.__BENCH_READY__ = true;
`;
}

function createRoutesSource(routeCount) {
  const loaders = [];
  for (let route = 1; route <= routeCount; route += 1) {
    const name = routeName(route);
    loaders.push(
      `  () => import(/* webpackChunkName: "${name}" */ "./pages/${name}/page.js")`,
    );
  }
  return `export const routeLoaders = [\n${loaders.join(",\n")}\n];\n`;
}

function createLeafSource(route, moduleNumber, payloadItems) {
  const name = moduleName(moduleNumber).replace("-", "_");
  const payload = Array.from(
    { length: payloadItems },
    (_, item) => `"route-${route}-module-${moduleNumber}-payload-${item}"`,
  ).join(",\n  ");

  return `const payload_${name} = Object.freeze([\n  ${payload}\n]);

export function value_${name}(seed) {
  let result = seed + ${route * 97 + moduleNumber};
  for (const item of payload_${name}) {
    result = (result * 33 + item.length) % 1000003;
  }
  return result;
}
`;
}

function createPageSource(route, modulesPerRoute) {
  const name = routeName(route);
  const imports = [];
  const calls = [];
  for (let moduleNumber = 1; moduleNumber <= modulesPerRoute; moduleNumber += 1) {
    const fileName = moduleName(moduleNumber);
    const exportName = fileName.replace("-", "_");
    imports.push(`import { value_${exportName} } from "./${fileName}.js";`);
    calls.push(`value_${exportName}(${route + moduleNumber})`);
  }

  return `${imports.join("\n")}

const REVISION = "initial";
const ROUTE = ${route};
const CHECKSUM = [\n  ${calls.join(",\n  ")}\n].reduce((sum, value) => (sum + value) % 1000003, 0);

export function renderPage() {
  globalThis.__BENCH_RENDER__({ route: ROUTE, revision: REVISION, checksum: CHECKSUM });
}

if (globalThis.__ACTIVE_ROUTE__ === ROUTE) {
  renderPage();
}

const hot = import.meta.turbopackHot || import.meta.webpackHot;
if (hot) {
  hot.accept();
}

export const routeName = "${name}";
`;
}

function createIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>100 mostly-isolated routes benchmark</title>
  </head>
  <body>
    <main id="app"></main>
    <script src="/main.js"></script>
  </body>
</html>
`;
}

function generateFixture(options) {
  const {
    outputDir,
    routeCount = DEFAULT_FIXTURE_OPTIONS.routeCount,
    modulesPerRoute = DEFAULT_FIXTURE_OPTIONS.modulesPerRoute,
    payloadItems = DEFAULT_FIXTURE_OPTIONS.payloadItems,
  } = options;

  if (!outputDir || !path.isAbsolute(outputDir)) {
    throw new TypeError("outputDir must be an absolute path");
  }
  assertPositiveInteger("routeCount", routeCount);
  assertPositiveInteger("modulesPerRoute", modulesPerRoute);
  assertPositiveInteger("payloadItems", payloadItems);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  writeFile(path.join(outputDir, "src/index.js"), createIndexSource(routeCount));
  writeFile(path.join(outputDir, "src/routes.js"), createRoutesSource(routeCount));
  writeFile(path.join(outputDir, "public/index.html"), createIndexHtml());

  for (let route = 1; route <= routeCount; route += 1) {
    const routeDir = path.join(outputDir, "src/pages", routeName(route));
    writeFile(path.join(routeDir, "page.js"), createPageSource(route, modulesPerRoute));
    for (let moduleNumber = 1; moduleNumber <= modulesPerRoute; moduleNumber += 1) {
      writeFile(
        path.join(routeDir, `${moduleName(moduleNumber)}.js`),
        createLeafSource(route, moduleNumber, payloadItems),
      );
    }
  }

  const sharedModules = 2;
  const routeLocalModules = routeCount * (modulesPerRoute + 1);
  const totalModules = sharedModules + routeLocalModules;
  const metadata = {
    routeCount,
    modulesPerRoute,
    payloadItems,
    sharedModules,
    routeLocalModules,
    totalModules,
    routeLocalModuleRatio: routeLocalModules / totalModules,
  };
  writeFile(path.join(outputDir, "fixture.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

module.exports = {
  DEFAULT_FIXTURE_OPTIONS,
  generateFixture,
  routeName,
};
