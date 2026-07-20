const assert = require("node:assert/strict");
const test = require("node:test");

const webpackConfig = require("../webpack.config.cjs");
const rspackConfig = require("../rspack.config.cjs");

test("webpack and Rspack align dev-server and lazy compilation scope", () => {
  assert.deepEqual(webpackConfig.devServer, rspackConfig.devServer);
  assert.deepEqual(webpackConfig.optimization, rspackConfig.optimization);
  assert.deepEqual(webpackConfig.cache, {
    type: "memory",
    maxGenerations: 1,
  });
  assert.equal(rspackConfig.cache, true);
  const { backend, ...webpackLazyCompilation } =
    webpackConfig.experiments.lazyCompilation;
  assert.deepEqual(webpackLazyCompilation, {
    entries: false,
    imports: true,
  });
  assert.equal(typeof backend, "function");
  assert.deepEqual(rspackConfig.lazyCompilation, {
    entries: false,
    imports: true,
  });
  assert.equal(rspackConfig.experiments.incremental.buildChunkGraph, false);
});
