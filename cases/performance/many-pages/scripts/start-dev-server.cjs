const path = require("node:path");

const [bundler, portValue] = process.argv.slice(2);
const port = Number(portValue);
if (!new Set(["webpack", "rspack"]).has(bundler) || !Number.isInteger(port)) {
  throw new Error("usage: start-dev-server.cjs <webpack|rspack> <port>");
}

const caseDir = path.resolve(__dirname, "..");
const config = require(path.join(caseDir, `${bundler}.config.cjs`));
config.devServer.port = port;

let compiler;
let DevServer;
if (bundler === "webpack") {
  const webpack = require("webpack");
  DevServer = require("webpack-dev-server");
  compiler = webpack(config);
} else {
  const rspack = require("@rspack/core");
  ({ RspackDevServer: DevServer } = require("@rspack/dev-server"));
  compiler = rspack.rspack(config);
  const lazyCompilationMiddleware = rspack.lazyCompilationMiddleware(compiler);
  const setupMiddlewares = config.devServer.setupMiddlewares;
  config.devServer.setupMiddlewares = (middlewares, server) => {
    const configured = setupMiddlewares ? setupMiddlewares(middlewares, server) : middlewares;
    return [...configured, lazyCompilationMiddleware];
  };
}

const server = new DevServer(config.devServer, compiler);
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop().then(() => process.exit(0), (error) => {
      console.error(error);
      process.exit(1);
    });
  });
}

server.start().then(
  () => console.log(`BENCH_SERVER_READY http://127.0.0.1:${port}`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
