const fromBase64 =
  typeof Uint8Array.fromBase64 === "function" ? Uint8Array.fromBase64 : null;

export function base64Decode(base64) {
  if (fromBase64 !== null) {
    return fromBase64(base64);
  }

  const binaryString = atob(base64);
  const buffer = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }

  return buffer;
}
