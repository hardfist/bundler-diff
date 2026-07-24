const path = require("node:path");

const caseDir = __dirname;
const loaderPath = path.resolve(caseDir, "loaders/counting-loader.cjs");
const configDependencies = [__filename, loaderPath];

function createConfigs(bundler, createCache) {
  const traceFile = path.resolve(caseDir, `.${bundler}-cache`, "loader-runs.jsonl");

  return [
    { name: "client", entry: "./src/client.js" },
    { name: "server", entry: "./src/server.js" },
  ].map(({ name, entry }) => ({
    name,
    mode: "development",
    target: "node",
    devtool: false,
    context: caseDir,
    entry: {
      entry,
    },
    output: {
      path: path.resolve(caseDir, "dist", bundler, name),
      filename: "[name].js",
      clean: true,
    },
    cache: createCache(),
    module: {
      rules: [
        {
          test: /\.js$/,
          include: path.resolve(caseDir, "src"),
          use: {
            loader: loaderPath,
            options: {
              compiler: name,
              traceFile,
            },
          },
        },
      ],
    },
    optimization: {
      minimize: false,
    },
  }));
}

module.exports = {
  configDependencies,
  createConfigs,
};
