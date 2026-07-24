const path = require("node:path");

const { createWebpackLazyBackend } = require("./scripts/lib/webpack-lazy-backend.cjs");

function createBundlerConfig(bundler) {
  if (bundler !== "webpack" && bundler !== "rspack") {
    throw new Error(`unsupported JavaScript bundler: ${bundler}`);
  }

  const fixtureDir = path.join(__dirname, ".generated");
  const config = {
    name: `many-pages-${bundler}`,
    mode: "development",
    context: fixtureDir,
    entry: "./src/index.js",
    devtool: false,
    output: {
      path: path.join(fixtureDir, `.${bundler}-dist`),
      filename: "main.js",
      chunkFilename: "[name].js",
      publicPath: "/",
    },
    optimization: {
      minimize: false,
    },
    devServer: {
      host: "127.0.0.1",
      hot: true,
      liveReload: false,
      historyApiFallback: true,
      static: {
        directory: path.join(fixtureDir, "public"),
      },
      client: {
        logging: "none",
        overlay: false,
      },
      devMiddleware: {
        stats: "errors-warnings",
      },
    },
    infrastructureLogging: {
      level: "error",
    },
  };

  const lazyCompilation = {
    entries: false,
    imports: true,
  };
  if (bundler === "webpack") {
    config.cache = {
      type: "memory",
      maxGenerations: 1,
    };
    config.experiments = {
      lazyCompilation: {
        ...lazyCompilation,
        backend: createWebpackLazyBackend(),
      },
    };
  } else {
    config.cache = true;
    config.experiments = {
      incremental: {
        // This benchmark intentionally includes full chunk-graph work in HMR.
        buildChunkGraph: false,
      },
    };
    config.lazyCompilation = lazyCompilation;
  }
  return config;
}

module.exports = { createBundlerConfig };
