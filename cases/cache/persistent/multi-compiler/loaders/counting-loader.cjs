const fs = require("node:fs");
const path = require("node:path");

module.exports = function countingLoader(source) {
  const { compiler, traceFile } = this.getOptions();
  const resource = path
    .relative(path.resolve(__dirname, ".."), this.resourcePath)
    .split(path.sep)
    .join("/");

  fs.mkdirSync(path.dirname(traceFile), { recursive: true });
  fs.appendFileSync(traceFile, `${JSON.stringify({ compiler, resource })}\n`);

  return source;
};
