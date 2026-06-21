"use strict";
(function() {
exports.ids = ["entry"];
exports.modules = {
"./src/entry.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
/* import */ var _message_js__rspack_import_0 = __webpack_require__("./src/message.js");


console.log((0,_message_js__rspack_import_0.formatMessage)("basic case"));


},
"./src/message.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  formatMessage: () => (formatMessage)
});
function formatMessage(name) {
  return `compiled by ${name}`;
}


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