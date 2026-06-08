const path = require("path");

module.exports = {
  mode: "development",
  target: "web",
  entry: {
    "multi-f-entry": "./src/multi-f-entry.js",
  },
  output: {
    path: path.resolve(__dirname, "rspack-multi-f-dist"),
    filename: "[name].js",
    chunkFilename: "[name].js",
    cssFilename: "[name].css",
    cssChunkFilename: "[name].css",
    publicPath: "auto",
    clean: true,
  },
  experiments: {
    css: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        type: "css",
      },
    ],
  },
  optimization: {
    minimize: false,
    runtimeChunk: "single",
  },
};
