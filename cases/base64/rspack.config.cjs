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
  resolve: {
    alias: {
      "@turbopack/base64": path.resolve(__dirname, "src/base64-shim.js"),
    },
  },
  optimization: {
    minimize: false,
  },
};
