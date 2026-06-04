module.exports = [
"[project]/src/counter.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

let current = 0;
const snapshot = current;
function inc() {
    current += 1;
    return current;
}
const __TURBOPACK__default__export__ = {
    label: "counter-namespace",
    get current () {
        return current;
    }
};
__turbopack_context__.s([
    "current",
    ()=>current,
    "default",
    ()=>__TURBOPACK__default__export__,
    "inc",
    0,
    inc,
    "snapshot",
    0,
    snapshot
]);
}),
"[project]/src/legacy.cjs [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const secret = "legacy";
module.exports = {
    kind: "commonjs",
    named: `named-${secret}`,
    default: {
        from: "legacy-default-property"
    },
    extra: "legacy-extra",
    describe (prefix) {
        return `${prefix}:${this.kind}:${this.named}`;
    }
};
}),
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
"[project]/src/fixtures/payload.bin.[bytes].mjs [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[turbopack]/shared/base64.ts [client] (ecmascript)");
"use turbopack no side effects";
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$turbopack$5d2f$shared$2f$base64$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["base64Decode"])("cGF5bG9hZC1ieXRlcwo");
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
}),
"[project]/src/message.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

function formatMessage(name) {
    return `compiled by ${name}`;
}
function defaultMessage(name) {
    return `default:${name}`;
}
__turbopack_context__.s([
    "formatMessage",
    0,
    formatMessage
]);
}),
"[project]/src/legacy-reexport.js [client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/legacy.cjs [client] (ecmascript)");
;
;
__turbopack_context__.s([]);
}),
"[project]/src/legacy-reexport.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2d$reexport$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/legacy-reexport.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/legacy.cjs [client] (ecmascript)");
__turbopack_context__.s([
    "legacyDefault",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__["default"]
]);
__turbopack_context__.j(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__);
}),
"[project]/src/features/feature-a.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

const name = "feature-a";
const __TURBOPACK__default__export__ = "A";
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "name",
    0,
    name
]);
}),
"[project]/src/features/feature-b.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

const name = "feature-b";
const __TURBOPACK__default__export__ = "B";
__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "name",
    0,
    name
]);
}),
"[project]/src/context-consumer.js (require.context ./features/*)", (function(__turbopack_context__){

__turbopack_context__.v({
    "./feature-a.js": {
        id: ()=>"[project]/src/features/feature-a.js [client] (ecmascript)",
        module: ()=>__turbopack_context__.r("[project]/src/features/feature-a.js [client] (ecmascript)")
    },
    "./feature-b.js": {
        id: ()=>"[project]/src/features/feature-b.js [client] (ecmascript)",
        module: ()=>__turbopack_context__.r("[project]/src/features/feature-b.js [client] (ecmascript)")
    }
});
}),
"[project]/src/context-consumer.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

const featureContext = __turbopack_context__.f(__turbopack_context__.r("[project]/src/context-consumer.js (require.context ./features/*)"));
function loadFeatures() {
    return featureContext.keys().sort().map((key)=>{
        const request = featureContext.import ? `${key}?query=1#hash` : key;
        const mod = featureContext(request);
        return `${key}:${mod.name}:${featureContext.resolve(key).includes("feature")}`;
    }).join("|");
}
async function loadFeatureAsync(key) {
    const request = `${key}?via=import#fragment`;
    const mod = featureContext.import ? await featureContext.import(request) : featureContext(key);
    return mod.name;
}
__turbopack_context__.s([
    "loadFeatureAsync",
    0,
    loadFeatureAsync,
    "loadFeatures",
    0,
    loadFeatures
]);
}),
"[project]/src/meta.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__import$2e$meta__ = {
    get url () {
        return __turbopack_context__.F("src/meta.js");
    }
};
const metaUrl = __TURBOPACK__import$2e$meta__.url;
const metaProtocol = new URL(metaUrl).protocol;
__turbopack_context__.s([
    "metaProtocol",
    0,
    metaProtocol,
    "metaUrl",
    0,
    metaUrl
]);
}),
"[project]/src/path-consumer.cjs [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

exports.paths = {
    dirnameTail: ("TURBOPACK compile-time value", "/ROOT/src").split(/[\\/]/).slice(-2).join("/"),
    filenameTail: ("TURBOPACK compile-time value", "/ROOT/src/path-consumer.cjs").split(/[\\/]/).slice(-2).join("/")
};
}),
"[project]/src/entry.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__url__external__node$3a$path__ = __turbopack_context__.x("node:path", ()=>require("node:path"), true);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$payload$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/fixtures/payload.bin.[bytes].mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/counter.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$message$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/message.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/legacy.cjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2d$reexport$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/legacy-reexport.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2d$reexport$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/legacy-reexport.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2d$consumer$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context-consumer.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$meta$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/meta.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$path$2d$consumer$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/path-consumer.cjs [client] (ecmascript)");
;
;
;
;
;
;
;
;
;
const decoder = new TextDecoder();
async function main() {
    const first = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["inc"])();
    const lazy = await __turbopack_context__.A("[project]/src/lazy.js [client] (ecmascript, async loader)");
    const tla = await __turbopack_context__.A("[project]/src/tla.js [client] (ecmascript, async loader)");
    const requireConsumer = await __turbopack_context__.A("[project]/src/require-consumer.cjs [client] (ecmascript, async loader)");
    const featureB = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2d$consumer$2e$js__$5b$client$5d$__$28$ecmascript$29$__["loadFeatureAsync"])("./feature-b.js");
    const legacyNamedKey = [
        "named"
    ][0];
    const legacyExtraKey = [
        "extra"
    ][0];
    const summary = {
        message: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$message$2e$js__$5b$client$5d$__$28$ecmascript$29$__["formatMessage"])("complex case"),
        pathBase: __TURBOPACK__url__external__node$3a$path__["default"].basename("/tmp/complex-case.txt"),
        bytes: decoder.decode(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$fixtures$2f$payload$2e$bin$2e5b$bytes$5d2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["default"]).trimEnd(),
        counter: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["snapshot"]}->${first}->${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["current"]}->${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$counter$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].current}`,
        legacyDefaultKeys: Object.keys(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__["default"]).sort().join(","),
        legacyStar: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2d$reexport$2e$js__$5b$client$5d$__$28$ecmascript$29$__[legacyNamedKey]}:${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2d$reexport$2e$js__$5b$client$5d$__$28$ecmascript$29$__[legacyExtraKey]}:${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$legacy$2d$reexport$2e$js__$5b$client$5d$__$28$ecmascript$29$__.legacyDefault.kind}`,
        features: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2d$consumer$2e$js__$5b$client$5d$__$28$ecmascript$29$__["loadFeatures"])(),
        featureB,
        lazy: `${lazy.lazyValue}:${lazy.default()}`,
        tla: `${tla.default}:${tla.upper}`,
        requireConsumer: `${requireConsumer.readViaRequire()}:${requireConsumer.requireType}`,
        metaTail: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$meta$2e$js__$5b$client$5d$__$28$ecmascript$29$__["metaUrl"].split("/").slice(-2).join("/"),
        metaProtocol: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$meta$2e$js__$5b$client$5d$__$28$ecmascript$29$__["metaProtocol"],
        pathTails: `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$path$2d$consumer$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__["paths"].dirnameTail}:${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$path$2d$consumer$2e$cjs__$5b$client$5d$__$28$ecmascript$29$__["paths"].filenameTail}`
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
}
main().catch((error)=>{
    console.error(error);
    process.exitCode = 1;
});
;
__turbopack_context__.s([
    "main",
    0,
    main
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
"[project]/src/tla.js [client] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "src_tla_0qr3_jl.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/src/tla.js [client] (ecmascript)");
    });
});
}),
"[project]/src/require-consumer.cjs [client] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "src_require-consumer_cjs_01j0mvk._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/src/require-consumer.cjs [client] (ecmascript)");
    });
});
}),
];