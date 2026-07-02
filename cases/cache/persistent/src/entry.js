import { catalog } from "./catalog.js";
import { summarizeCart } from "./summary.js";

console.log(`persistent cache case: ${summarizeCart(catalog)}`);
