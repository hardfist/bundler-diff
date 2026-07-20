const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createBundlerConfig } = require("../bundler-config.cjs");

function waitFor(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function poll() {
      if (predicate()) return resolve();
      if (Date.now() >= deadline) return reject(new Error("condition was not met"));
      setTimeout(poll, 10);
    }
    poll();
  });
}

test("Webpack lazy modules deactivate immediately when the client disconnects", async (t) => {
  let invalidations = 0;
  const compiler = {
    getInfrastructureLogger: () => ({ log() {}, warn() {} }),
    watching: {
      invalidate() {
        invalidations += 1;
      },
    },
  };
  const backend = createBundlerConfig("webpack").experiments.lazyCompilation.backend;
  const api = await new Promise((resolve, reject) => {
    backend(compiler, (error, result) => (error ? reject(error) : resolve(result)));
  });
  t.after(
    () =>
      new Promise((resolve, reject) => {
        api.dispose((error) => (error ? reject(error) : resolve()));
      }),
  );

  const lazyModule = { identifier: () => "/fixture/route-001/page.js" };
  const moduleInfo = api.module(lazyModule);
  assert.equal(moduleInfo.active, false);

  const endpoint = decodeURIComponent(
    moduleInfo.client.slice(moduleInfo.client.indexOf("?") + 1),
  );
  const response = await new Promise((resolve, reject) => {
    const request = http.get(`${endpoint}${moduleInfo.data}`, resolve);
    request.on("error", reject);
  });
  assert.equal(api.module(lazyModule).active, true);
  assert.equal(invalidations, 1);

  response.destroy();
  await waitFor(() => api.module(lazyModule).active === false);
});
