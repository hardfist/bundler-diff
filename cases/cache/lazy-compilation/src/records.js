export const records = [
  { name: "entry", weight: 3 },
  { name: "persistent-cache", weight: 8 },
  { name: "lazy-boundary", weight: 13 },
];

export function summarizeRecords() {
  return `${records.length} eagerly loaded records, weight ${records.reduce(
    (sum, record) => sum + record.weight,
    0
  )}`;
}
