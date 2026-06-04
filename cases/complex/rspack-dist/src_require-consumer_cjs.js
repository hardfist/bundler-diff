exports.ids = ["src_require-consumer_cjs"];
exports.modules = {
"./src/require-consumer.cjs"(__unused_rspack_module, exports, __webpack_require__) {
const legacy = __webpack_require__("./src/legacy.cjs");
const counter = __webpack_require__("./src/counter.js");

exports.readViaRequire = function readViaRequire() {
  return `${legacy.named}:${counter.inc()}:${counter.current}`;
};

exports.requireType = 'function';
exports["default"] = "require-consumer-default";


},

};
;