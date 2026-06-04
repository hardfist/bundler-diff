"use strict";
exports.ids = ["src_tla_js"];
exports.modules = {
"./src/tla.js"(module, __webpack_exports__, __webpack_require__) {
__webpack_require__.a(module, async function (__rspack_load_async_deps, __rspack_async_done) { try {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (__rspack_default_export),
  upper: () => (upper)
});
/* import */ var _counter_js__rspack_import_0 = __webpack_require__("./src/counter.js");


const awaited = await Promise.resolve(`tla-${_counter_js__rspack_import_0.current}`);

/* export default */ const __rspack_default_export = (awaited);
const upper = awaited.toUpperCase();

__rspack_async_done();
} catch(e) { __rspack_async_done(e); } }, 1);

},

};
;