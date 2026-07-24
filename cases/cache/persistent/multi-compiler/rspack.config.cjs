const path = require("node:path");

module.exports = ["client", "server"].map((name) => ({
  name,
  mode: "development",
  target: "node",
  context: __dirname,
  entry: "./src/entry.js",
  output: {
    path: path.resolve(__dirname, "dist", "rspack", name),
    filename: "entry.js",
    clean: true,
  },
  cache: {
    type: "persistent",
    buildDependencies: [__filename],
    version: "persistent-cache-multi-compiler",
    storage: {
      type: "filesystem",
      directory: path.resolve(__dirname, ".rspack-cache"),
    },
  },
}));
