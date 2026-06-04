module.exports = [
"[turbopack]/shared/base64.ts [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

var e = new Error('Could not parse module \'[turbopack]/shared/base64.ts\'\n\nResource path "shared/base64.ts" needs to be on project filesystem ""\n\nDebug info:\n- Execution of <WebpackLoadersProcessedAsset as Asset>::content failed\n- Execution of WebpackLoadersProcessedAsset::process failed\n- Resource path "shared/base64.ts" needs to be on project filesystem ""');
e.code = 'MODULE_UNPARSABLE';
throw e;
}),
"[project]/src/entry.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[turbopack]/shared/base64.ts [client] (ecmascript)");
;
const decoder = new TextDecoder();
const decoded = decoder.decode((0, __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["base64Decode"])("cnVudGltZS1sb2FkZXI=")).trimEnd();
console.log(`decoded:${decoded}`);
__turbopack_context__.s([]);
}),
];