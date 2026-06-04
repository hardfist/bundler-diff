"use strict";
exports.ids = ["src_lazy_js"];
exports.modules = {
"./src/lazy.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (lazyDefault),
  lazyValue: () => (lazyValue)
});
/* import */ var _counter_js__rspack_import_0 = __webpack_require__("./src/counter.js");


const lazyValue = `lazy-${(0,_counter_js__rspack_import_0.inc)()}-${_counter_js__rspack_import_0.current}`;
function lazyDefault() {
  return `lazy-default-${_counter_js__rspack_import_0.current}`;
}


},

};
;