export async function loadStyledFeature() {
  const mod = await import('./styled-feature.js');
  return mod.styledFeature;
}

loadStyledFeature().then((value) => {
  globalThis.__MULTI_F_VALUE__ = value;
});
