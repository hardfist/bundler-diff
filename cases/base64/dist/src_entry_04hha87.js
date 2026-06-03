module.exports = [
63, ((__turbopack_context__) => {
"use strict";

// MERGED MODULE: [project]/src/entry.js [client] (ecmascript)
;
// MERGED MODULE: [turbopack]/shared/base64.ts [client] (ecmascript)
;
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
;
const decoder = new TextDecoder();
const alphaBytes = base64Decode("YWxwaGEtYnl0ZXM=");
const betaBytes = base64Decode("YmV0YS1ieXRlcw==");
const alpha = decoder.decode(alphaBytes);
const beta = decoder.decode(betaBytes);
const totalBytes = alphaBytes.length + betaBytes.length;
console.log(`${alpha}|${beta}|${totalBytes}`);
__turbopack_context__.s([], 63);
}),
];

//# sourceMappingURL=src_entry_04hha87.js.map