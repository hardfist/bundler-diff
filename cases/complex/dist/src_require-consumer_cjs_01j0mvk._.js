module.exports = [
"[project]/src/require-consumer.cjs [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const legacy = __turbopack_context__.r("[project]/src/legacy.cjs [client] (ecmascript)");
const counter = __turbopack_context__.r("[project]/src/counter.js [client] (ecmascript)");
exports.readViaRequire = function readViaRequire() {
    return `${legacy.named}:${counter.inc()}:${counter.current}`;
};
exports.requireType = ("TURBOPACK compile-time value", "function");
exports.default = "require-consumer-default";
}),
];