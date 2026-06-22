export function summarizeCart(items) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return `${items.length} items, total ${total}`;
}
