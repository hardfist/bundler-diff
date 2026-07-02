import { summarizeRecords } from "./records.js";

console.log(`lazy compilation cache case: ${summarizeRecords()}`);

async function main() {
  const { formatLazyReport } = await import("./lazy/report.js");
  console.log(formatLazyReport());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
