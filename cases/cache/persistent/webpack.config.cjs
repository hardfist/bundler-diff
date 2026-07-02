const path = require("path");

module.exports = {
  name: "persistent-cache-case-webpack",
  mode: "development",
  target: "node",
  context: __dirname,
  entry: {
    entry: "./src/entry.js",
  },
  output: {
    path: path.resolve(__dirname, "dist/webpack"),
    filename: "[name].js",
    clean: true,
  },
  cache: {
    type: "filesystem",
    cacheDirectory: path.resolve(__dirname, ".webpack-cache"),
    name: "persistent-cache-case-webpack",
    buildDependencies: {
      config: [__filename],
    },
  },
  optimization: {
    minimize: false,
    runtimeChunk: "single",
  },
};
