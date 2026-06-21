import alphaBytes from "./fixtures/alpha.bin" with { type: "bytes" };
import betaBytes from "./fixtures/beta.bin" with { type: "bytes" };

const decoder = new TextDecoder();

const alpha = decoder.decode(alphaBytes).trimEnd();
const beta = decoder.decode(betaBytes).trimEnd();
const totalBytes = alphaBytes.length + betaBytes.length;

console.log(`${alpha}|${beta}|${totalBytes}`);
