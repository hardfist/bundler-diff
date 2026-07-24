const path = require("node:path");
const { configDependencies, createConfigs } = require("./shared-config.cjs");

module.exports = createConfigs("rspack", () => ({
  type: "persistent",
  buildDependencies: [__filename, ...configDependencies],
  version: "persistent-cache-multi-compiler",
  storage: {
    type: "filesystem",
    directory: path.resolve(__dirname, ".rspack-cache"),
  },
}));
