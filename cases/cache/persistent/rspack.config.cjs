const path = require("path");

module.exports = {
  name: "persistent-cache-case-rspack",
  mode: "development",
  target: "node",
  context: __dirname,
  entry: {
    entry: "./src/entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist/rspack"),
    filename: "[name].js",
    clean: true,
  },
  cache: {
    type: "persistent",
    buildDependencies: [__filename],
    version: "persistent-cache-case-rspack",
    storage: {
      type: "filesystem",
      directory: path.resolve(__dirname, ".rspack-cache"),
    },
  },
  optimization: {
    minimize: false,
    runtimeChunk: "single",
  },
};
