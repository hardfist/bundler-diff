const path = require("node:path");

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
    cache: false,
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
    config.experiments = { lazyCompilation };
  } else {
    config.lazyCompilation = lazyCompilation;
  }
  return config;
}

module.exports = { createBundlerConfig };
