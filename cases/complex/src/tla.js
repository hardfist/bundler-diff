import { current } from "./counter.js";

const awaited = await Promise.resolve(`tla-${current}`);

export default awaited;
export const upper = awaited.toUpperCase();
