const path = require("path");

module.exports = {
  mode: "development",
  target: "node",
  entry: {
    entry: "./src/entry.js",
  },
  output: {
    path: path.resolve(__dirname, "rspack-dist"),
    filename: "[name].js",
    clean: true,
  },
  optimization: {
    minimize: false,
    runtimeChunk: "single",
  },
};
