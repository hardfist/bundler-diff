(() => {
"use strict";
var __webpack_modules__ = ({
"./src/base64-shim.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  base64Decode: () => (base64Decode)
});
const fromBase64 =
  typeof Uint8Array.fromBase64 === "function" ? Uint8Array.fromBase64 : null;

function base64Decode(base64) {
  if (fromBase64 !== null) {
    return fromBase64(base64);
  }

  const binaryString = atob(base64);
  const buffer = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }

  return buffer;
}


},

});
// The module cache
var __webpack_module_cache__ = {};

// The require function
function __webpack_require__(moduleId) {

// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;

}

// webpack/runtime/define_property_getters
(() => {
__webpack_require__.d = (exports, getters, values) => {
	var define = (defs, kind) => {
		for(var key in defs) {
			if(__webpack_require__.o(defs, key) && !__webpack_require__.o(exports, key)) {
				Object.defineProperty(exports, key, { enumerable: true, [kind]: defs[key] });
			}
		}
	};
	define(getters, "get");
	define(values, "value");
};
})();
// webpack/runtime/has_own_property
(() => {
__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
})();
// webpack/runtime/make_namespace_object
(() => {
// define __esModule on exports
__webpack_require__.r = (exports) => {
	if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
	}
	Object.defineProperty(exports, '__esModule', { value: true });
};
})();
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* import */ var _turbopack_base64__rspack_import_0 = __webpack_require__("./src/base64-shim.js");


const decoder = new TextDecoder();

const alphaBytes = (0,_turbopack_base64__rspack_import_0.base64Decode)("YWxwaGEtYnl0ZXM=");
const betaBytes = (0,_turbopack_base64__rspack_import_0.base64Decode)("YmV0YS1ieXRlcw==");
const alpha = decoder.decode(alphaBytes);
const beta = decoder.decode(betaBytes);
const totalBytes = alphaBytes.length + betaBytes.length;

console.log(`${alpha}|${beta}|${totalBytes}`);

})();

})()
;