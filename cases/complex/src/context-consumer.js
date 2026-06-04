const featureContext = require.context("./features", false, /feature-[ab]\.js$/);

export function loadFeatures() {
  return featureContext
    .keys()
    .sort()
    .map((key) => {
      const request = featureContext.import ? `${key}?query=1#hash` : key;
      const mod = featureContext(request);
      return `${key}:${mod.name}:${featureContext.resolve(key).includes("feature")}`;
    })
    .join("|");
}

export async function loadFeatureAsync(key) {
  const request = `${key}?via=import#fragment`;
  const mod = featureContext.import
    ? await featureContext.import(request)
    : featureContext(key);
  return mod.name;
}
