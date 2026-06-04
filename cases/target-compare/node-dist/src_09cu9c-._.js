module.exports = [
"[project]/src/message.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

function formatMessage(name) {
    return `target-compare:${name}`;
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
console.log((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$message$2e$js__$5b$client$5d$__$28$ecmascript$29$__["formatMessage"])("entry"));
async function loadLazyMessage() {
    const { lazyMessage } = await __turbopack_context__.A("[project]/src/lazy.js [client] (ecmascript, async loader)");
    return lazyMessage("dynamic");
}
loadLazyMessage().then((message)=>{
    console.log(message);
});
__turbopack_context__.s([
    "loadLazyMessage",
    0,
    loadLazyMessage
]);
}),
"[project]/src/lazy.js [client] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "src_lazy_18swte0.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/src/lazy.js [client] (ecmascript)");
    });
});
}),
];