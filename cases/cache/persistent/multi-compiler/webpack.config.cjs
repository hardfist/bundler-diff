const path = require("node:path");
const { configDependencies, createConfigs } = require("./shared-config.cjs");

module.exports = createConfigs("webpack", () => ({
  type: "filesystem",
  cacheDirectory: path.resolve(__dirname, ".webpack-cache"),
  buildDependencies: {
    config: [__filename, ...configDependencies],
  },
  idleTimeoutForInitialStore: 0,
}));
