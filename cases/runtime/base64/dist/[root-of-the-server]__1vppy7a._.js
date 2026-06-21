module.exports = [
"[turbopack]/shared/base64.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Evaluate the ES2024 feature check once at module load time.
const _fromBase64 = typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64 : null;
function base64Decode(base64) {
    if (_fromBase64 !== null) {
        return _fromBase64(base64);
    }
    const binaryString = atob(base64);
    const buffer = new Uint8Array(binaryString.length);
    for(let i = 0; i < binaryString.length; i++){
        buffer[i] = binaryString.charCodeAt(i);
    }
    return buffer;
}
__turbopack_context__.s([
    "base64Decode",
    0,
    base64Decode
]);
}),
"[project]/src/fixtures/alpha.bin.[bytes].mjs [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[turbopack]/shared/base64.ts [client] (ecmascript)");
"use turbopack no side effects";
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["base64Decode"])("YWxwaGEtYnl0ZXMK");
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
}),
"[project]/src/fixtures/beta.bin.[bytes].mjs [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[turbopack]/shared/base64.ts [client] (ecmascript)");
"use turbopack no side effects";
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["base64Decode"])("YmV0YS1ieXRlcwo");
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
}),
"[project]/src/entry.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$alpha$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/fixtures/alpha.bin.[bytes].mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$beta$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/fixtures/beta.bin.[bytes].mjs [client] (ecmascript)");
;
;
const decoder = new TextDecoder();
const alpha = decoder.decode(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$alpha$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["default"]).trimEnd();
const beta = decoder.decode(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$beta$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["default"]).trimEnd();
const totalBytes = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$alpha$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["default"].length + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$beta$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["default"].length;
console.log(`${alpha}|${beta}|${totalBytes}`);
__turbopack_context__.s([]);
}),
];