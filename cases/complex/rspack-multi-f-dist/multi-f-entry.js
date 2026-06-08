"use strict";
(self["rspackChunkcomplex_case"] = self["rspackChunkcomplex_case"] || []).push([["multi-f-entry"], {
"./src/multi-f-entry.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  loadStyledFeature: () => (loadStyledFeature)
});
async function loadStyledFeature() {
  const mod = await __webpack_require__.e(/* import() */ "src_styled-feature_js").then(__webpack_require__.bind(__webpack_require__, "./src/styled-feature.js"));
  return mod.styledFeature;
}

loadStyledFeature().then((value) => {
  globalThis.__MULTI_F_VALUE__ = value;
});


},

},function(__webpack_require__) {
var __webpack_exec__ = function(moduleId) { return __webpack_require__(__webpack_require__.s = moduleId) }
var __webpack_exports__ = (__webpack_exec__("./src/multi-f-entry.js"));

}
]);