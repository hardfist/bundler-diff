const path = require("node:path");

const lazyPort = Number(process.env.WEBPACK_LAZY_PORT || 0);

module.exports = {
  name: "lazy-compilation-cache-case-webpack",
  mode: "development",
  target: "node",
  devtool: false,
  context: __dirname,
  entry: {
    entry: "./src/entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist/webpack"),
    filename: "[name].js",
    chunkFilename: "[name].js",
    clean: true,
  },
  cache: {
    type: "filesystem",
    cacheDirectory: path.resolve(__dirname, ".webpack-cache"),
    name: "lazy-compilation-cache-case-webpack",
    buildDependencies: {
      config: [__filename],
    },
    idleTimeout: 0,
    idleTimeoutAfterLargeChanges: 0,
    idleTimeoutForInitialStore: 0,
  },
  experiments: {
    lazyCompilation: {
      entries: false,
      imports: true,
      backend: {
        listen: {
          host: "127.0.0.1",
          port: lazyPort,
        },
      },
    },
  },
  optimization: {
    minimize: false,
    runtimeChunk: "single",
  },
  infrastructureLogging: {
    level: "error",
  },
};
