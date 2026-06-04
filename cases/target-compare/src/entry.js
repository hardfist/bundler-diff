import { formatMessage } from "./message.js";

console.log(formatMessage("entry"));

export async function loadLazyMessage() {
  const { lazyMessage } = await import("./lazy.js");
  return lazyMessage("dynamic");
}

loadLazyMessage().then((message) => {
  console.log(message);
});
