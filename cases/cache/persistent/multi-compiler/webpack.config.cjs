const path = require("node:path");

module.exports = ["client", "server"].map((name) => ({
  name,
  mode: "development",
  target: "node",
  context: __dirname,
  entry: "./src/entry.js",
  output: {
    path: path.resolve(__dirname, "dist", "webpack", name),
    filename: "entry.js",
    clean: true,
  },
  cache: {
    type: "filesystem",
    cacheDirectory: path.resolve(__dirname, ".webpack-cache"),
    buildDependencies: {
      config: [__filename],
    },
    idleTimeoutForInitialStore: 0,
  },
}));
