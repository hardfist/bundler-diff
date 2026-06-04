import { inc, current } from "./counter.js";

export const lazyValue = `lazy-${inc()}-${current}`;
export default function lazyDefault() {
  return `lazy-default-${current}`;
}
