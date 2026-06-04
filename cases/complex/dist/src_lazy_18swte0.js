module.exports = [
"[project]/src/lazy.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/counter.js [client] (ecmascript)");
;
const lazyValue = `lazy-${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["inc"])()}-${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["current"]}`;
function lazyDefault() {
    return `lazy-default-${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["current"]}`;
}
__turbopack_context__.s([
    "default",
    0,
    lazyDefault,
    "lazyValue",
    0,
    lazyValue
]);
}),
];