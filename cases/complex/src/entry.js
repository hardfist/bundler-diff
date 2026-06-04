import path from "node:path";
import payloadBytes from "./fixtures/payload.bin" with { type: "bytes" };
import counterDefault, { current, inc, snapshot } from "./counter.js";
import { formatMessage } from "./message.js";
import legacyDefault from "./legacy.cjs";
import * as legacyStar from "./legacy-reexport.js";
import { loadFeatureAsync, loadFeatures } from "./context-consumer.js";
import { metaProtocol, metaUrl } from "./meta.js";
import { paths } from "./path-consumer.cjs";

const decoder = new TextDecoder();

async function main() {
  const first = inc();
  const lazy = await import("./lazy.js");
  const tla = await import("./tla.js");
  const requireConsumer = await import("./require-consumer.cjs");
  const featureB = await loadFeatureAsync("./feature-b.js");

  const legacyNamedKey = ["named"][0];
  const legacyExtraKey = ["extra"][0];

  const summary = {
    message: formatMessage("complex case"),
    pathBase: path.basename("/tmp/complex-case.txt"),
    bytes: decoder.decode(payloadBytes).trimEnd(),
    counter: `${snapshot}->${first}->${current}->${counterDefault.current}`,
    legacyDefaultKeys: Object.keys(legacyDefault).sort().join(","),
    legacyStar: `${legacyStar[legacyNamedKey]}:${legacyStar[legacyExtraKey]}:${legacyStar.legacyDefault.kind}`,
    features: loadFeatures(),
    featureB,
    lazy: `${lazy.lazyValue}:${lazy.default()}`,
    tla: `${tla.default}:${tla.upper}`,
    requireConsumer: `${requireConsumer.readViaRequire()}:${requireConsumer.requireType}`,
    metaTail: metaUrl.split("/").slice(-2).join("/"),
    metaProtocol,
    pathTails: `${paths.dirnameTail}:${paths.filenameTail}`,
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { main };
