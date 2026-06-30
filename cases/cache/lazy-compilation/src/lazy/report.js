import { lazyMetrics } from "./weights.js";

export function formatLazyReport() {
  const checksum = lazyMetrics.reduce((sum, item) => sum + item.score, 0);
  return `lazy chunk report: ${lazyMetrics.length} lazy metrics, checksum ${checksum}`;
}
