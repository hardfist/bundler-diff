const defaultDecoder = new TextDecoder();

export async function createTurbopackTraceDecoder(source = new URL(
  "./turbopack_trace_decoder_wasm.wasm",
  import.meta.url
)) {
  const instance = await instantiate(source);
  const exports = instance.exports;

  if (!(exports.memory instanceof WebAssembly.Memory)) {
    throw new Error("turbopack trace decoder wasm does not export memory");
  }

  function readOutput() {
    const ptr = Number(exports.turbopack_trace_output_ptr());
    const len = Number(exports.turbopack_trace_output_len());
    const bytes = new Uint8Array(exports.memory.buffer, ptr, len).slice();
    return JSON.parse(defaultDecoder.decode(bytes));
  }

  function decode(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const ptr = Number(exports.turbopack_trace_alloc(bytes.byteLength));

    try {
      new Uint8Array(exports.memory.buffer, ptr, bytes.byteLength).set(bytes);
      const status = exports.turbopack_trace_decode(ptr, bytes.byteLength);
      const payload = readOutput();

      if (status !== 1) {
        const error = new Error(payload.error || "Unable to decode Turbopack trace");
        error.payload = payload;
        throw error;
      }

      return payload;
    } finally {
      exports.turbopack_trace_dealloc(ptr, bytes.byteLength);
      exports.turbopack_trace_clear_output();
    }
  }

  return { decode };
}

async function instantiate(source) {
  if (source instanceof WebAssembly.Instance) {
    return source;
  }

  if (source instanceof WebAssembly.Module) {
    return new WebAssembly.Instance(source, {});
  }

  if (source instanceof Response) {
    const bytes = await source.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance;
  }

  if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
    const bytes =
      source instanceof ArrayBuffer
        ? source
        : source.byteOffset === 0 && source.byteLength === source.buffer.byteLength
          ? source.buffer
          : source.buffer.slice(
              source.byteOffset,
              source.byteOffset + source.byteLength
            );
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance;
  }

  if (source instanceof URL && source.protocol === "file:") {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url"),
    ]);
    const bytes = await readFile(fileURLToPath(source));
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance;
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Unable to fetch Turbopack trace decoder wasm: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance;
}
