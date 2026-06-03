import { base64Decode } from "@turbopack/base64";

const decoder = new TextDecoder();

const alphaBytes = base64Decode("YWxwaGEtYnl0ZXM=");
const betaBytes = base64Decode("YmV0YS1ieXRlcw==");
const alpha = decoder.decode(alphaBytes);
const beta = decoder.decode(betaBytes);
const totalBytes = alphaBytes.length + betaBytes.length;

console.log(`${alpha}|${beta}|${totalBytes}`);
