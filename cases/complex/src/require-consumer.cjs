const legacy = require("./legacy.cjs");
const counter = require("./counter.js");

exports.readViaRequire = function readViaRequire() {
  return `${legacy.named}:${counter.inc()}:${counter.current}`;
};

exports.requireType = typeof require;
exports.default = "require-consumer-default";
