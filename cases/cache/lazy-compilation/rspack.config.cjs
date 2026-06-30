const path = require("node:path");

const lazyServerUrl =
  process.env.RSPACK_LAZY_SERVER_URL || "http://127.0.0.1:0/_rspack/lazy/trigger";

module.exports = {
  name: "lazy-compilation-cache-case-rspack",
  mode: "development",
  target: "node",
  devtool: false,
  context: __dirname,
  entry: {
    entry: "./src/entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist/rspack"),
    filename: "[name].js",
    chunkFilename: "[name].js",
    clean: true,
  },
  cache: {
    type: "persistent",
    buildDependencies: [__filename],
    version: "lazy-compilation-cache-case-rspack",
    storage: {
      type: "filesystem",
      directory: path.resolve(__dirname, ".rspack-cache"),
    },
  },
  lazyCompilation: {
    entries: false,
    imports: true,
    prefix: "/_rspack/lazy/trigger",
    serverUrl: lazyServerUrl,
  },
  optimization: {
    minimize: false,
    runtimeChunk: "single",
  },
  infrastructureLogging: {
    level: "error",
  },
};
