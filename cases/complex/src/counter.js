export let current = 0;
export const snapshot = current;

export function inc() {
  current += 1;
  return current;
}

export default {
  label: "counter-namespace",
  get current() {
    return current;
  },
};
