# Turbopack Trace Decoder Wasm

This crate builds a small `wasm32-unknown-unknown` decoder for Turbopack raw
trace logs. The JavaScript loader accepts a `Uint8Array` or `ArrayBuffer`
containing `.turbopack/trace.log` bytes and returns JSON rows decoded from the
`TRACEv0` postcard stream.

```js
import { createTurbopackTraceDecoder } from "./turbopack-trace-decoder.mjs";

const decoder = await createTurbopackTraceDecoder();
const trace = new Uint8Array(await file.arrayBuffer());
const decoded = decoder.decode(trace);
```
