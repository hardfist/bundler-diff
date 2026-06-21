import { base64Decode } from "@turbopack/base64";

const decoder = new TextDecoder();
const decoded = decoder.decode(base64Decode("cnVudGltZS1sb2FkZXI=")).trimEnd();

console.log(`decoded:${decoded}`);
