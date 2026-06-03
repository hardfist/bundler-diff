module.exports = [
"[project]/src/message.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

function formatMessage(name) {
    return `compiled by ${name}`;
}
__turbopack_context__.s([
    "formatMessage",
    0,
    formatMessage
]);
}),
"[project]/src/entry.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$message$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/message.js [client] (ecmascript)");
;
console.log((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$message$2e$js__$5b$client$5d$__$28$ecmascript$29$__["formatMessage"])("basic case"));
__turbopack_context__.s([]);
}),
];