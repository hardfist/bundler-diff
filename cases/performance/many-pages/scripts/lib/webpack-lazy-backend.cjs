const http = require("node:http");

// Webpack's default backend uses the same protocol but hardcodes a 120-second
// disconnect grace period. This benchmark needs that lifecycle delay to be zero.
function createWebpackLazyBackend({ deactivationDelayMs = 0 } = {}) {
  if (!Number.isInteger(deactivationDelayMs) || deactivationDelayMs < 0) {
    throw new Error("deactivationDelayMs must be a non-negative integer");
  }

  return (compiler, callback) => {
    const logger = compiler.getInfrastructureLogger("BenchmarkLazyCompilationBackend");
    const activeModules = new Map();
    const prefix = "/lazy-compilation-using-";
    const clientPath = require.resolve("webpack/hot/lazy-compilation-web.js");

    function deactivate(keys) {
      for (const key of keys) {
        const oldValue = activeModules.get(key) || 0;
        activeModules.set(key, oldValue - 1);
        if (oldValue === 1) {
          logger.log(`${key} is no longer in use. Next compilation will skip this module.`);
        }
      }
    }

    function requestListener(request, response) {
      if (!request.url?.startsWith(prefix)) {
        response.writeHead(404);
        response.end();
        return;
      }

      const keys = request.url.slice(prefix.length).split("@");
      request.socket.once("close", () => {
        if (deactivationDelayMs === 0) {
          deactivate(keys);
        } else {
          setTimeout(() => deactivate(keys), deactivationDelayMs);
        }
      });
      request.socket.setNoDelay(true);
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "*",
        "access-control-allow-headers": "*",
      });
      response.write("\n");

      let moduleActivated = false;
      for (const key of keys) {
        const oldValue = activeModules.get(key) || 0;
        activeModules.set(key, oldValue + 1);
        if (oldValue === 0) {
          logger.log(`${key} is now in use and will be compiled.`);
          moduleActivated = true;
        }
      }
      if (moduleActivated && compiler.watching) compiler.watching.invalidate();
    }

    const server = http.createServer(requestListener);
    const sockets = new Set();
    let closing = false;
    let initialized = false;

    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
      if (closing) socket.destroy();
    });
    server.on("clientError", (error, socket) => {
      if (closing || error.code === "ECONNRESET") {
        socket.destroy();
        return;
      }
      logger.warn(error);
    });
    server.once("error", (error) => {
      if (!initialized) callback(error);
      else logger.warn(error);
    });
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      initialized = true;
      const address = server.address();
      if (!address || typeof address === "string") {
        callback(new Error("Webpack lazy compilation backend has no TCP address"));
        return;
      }
      const urlBase = `http://127.0.0.1:${address.port}`;
      callback(null, {
        dispose(done) {
          closing = true;
          server.off("request", requestListener);
          server.close(done);
          for (const socket of sockets) socket.destroy();
        },
        module(originalModule) {
          const key = encodeURIComponent(
            originalModule.identifier().replace(/\\/g, "/").replace(/@/g, "_"),
          ).replace(/%(2F|3A|24|26|2B|2C|3B|3D)/g, decodeURIComponent);
          return {
            client: `${clientPath}?${encodeURIComponent(urlBase + prefix)}`,
            data: key,
            active: (activeModules.get(key) || 0) > 0,
          };
        },
      });
    });
  };
}

module.exports = { createWebpackLazyBackend };
