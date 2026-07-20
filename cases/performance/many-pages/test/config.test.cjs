const assert = require("node:assert/strict");
const test = require("node:test");

const webpackConfig = require("../webpack.config.cjs");
const rspackConfig = require("../rspack.config.cjs");

test("webpack and Rspack use equivalent dev-server and lazy compilation settings", () => {
  assert.deepEqual(webpackConfig.devServer, rspackConfig.devServer);
  assert.deepEqual(webpackConfig.optimization, rspackConfig.optimization);
  assert.deepEqual(webpackConfig.experiments.lazyCompilation, {
    entries: false,
    imports: true,
  });
  assert.deepEqual(rspackConfig.lazyCompilation, {
    entries: false,
    imports: true,
  });
});
