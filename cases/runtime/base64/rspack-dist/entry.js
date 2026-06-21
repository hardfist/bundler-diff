"use strict";
(function() {
exports.ids = ["entry"];
exports.modules = {
"./src/entry.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
/* import */ var _fixtures_alpha_bin__rspack_import_0 = __webpack_require__("./src/fixtures/alpha.bin");
/* import */ var _fixtures_beta_bin__rspack_import_1 = __webpack_require__("./src/fixtures/beta.bin");



const decoder = new TextDecoder();

const alpha = decoder.decode(_fixtures_alpha_bin__rspack_import_0).trimEnd();
const beta = decoder.decode(_fixtures_beta_bin__rspack_import_1).trimEnd();
const totalBytes = _fixtures_alpha_bin__rspack_import_0.length + _fixtures_beta_bin__rspack_import_1.length;

console.log(`${alpha}|${beta}|${totalBytes}`);


},
"./src/fixtures/alpha.bin"(module, __unused_rspack_exports, __webpack_require__) {
module.exports = __webpack_require__.tb("YWxwaGEtYnl0ZXMK");

},
"./src/fixtures/beta.bin"(module, __unused_rspack_exports, __webpack_require__) {
module.exports = __webpack_require__.tb("YmV0YS1ieXRlcwo=");

},

};
// load runtime
var __webpack_require__ = require("./runtime.js");
__webpack_require__.C(exports)
var __webpack_exec__ = function(moduleId) { return __webpack_require__(__webpack_require__.s = moduleId) }
var __webpack_exports__ = __webpack_require__.X(0, [], function() {
        return __webpack_exec__("./src/entry.js");
      });

})();