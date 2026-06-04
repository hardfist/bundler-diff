(function() {
exports.ids = ["entry"];
exports.modules = {
"./src/context-consumer.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  loadFeatureAsync: () => (loadFeatureAsync),
  loadFeatures: () => (loadFeatures)
});
const featureContext = __webpack_require__("./src/features sync feature-[ab]\\.js$");

function loadFeatures() {
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

async function loadFeatureAsync(key) {
  const request = `${key}?via=import#fragment`;
  const mod = featureContext.import
    ? await featureContext.import(request)
    : featureContext(key);
  return mod.name;
}


},
"./src/counter.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  current: () => (current),
  "default": () => (__rspack_default_export),
  inc: () => (inc),
  snapshot: () => (snapshot)
});
let current = 0;
const snapshot = current;

function inc() {
  current += 1;
  return current;
}

/* export default */ const __rspack_default_export = ({
  label: "counter-namespace",
  get current() {
    return current;
  },
});


},
"./src/entry.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  main: () => (main)
});
/* import */ var node_path__rspack_import_0 = __webpack_require__("node:path");
/* import */ var node_path__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_0);
/* import */ var _fixtures_payload_bin__rspack_import_1 = __webpack_require__("./src/fixtures/payload.bin");
/* import */ var _counter_js__rspack_import_2 = __webpack_require__("./src/counter.js");
/* import */ var _message_js__rspack_import_3 = __webpack_require__("./src/message.js");
/* import */ var _legacy_cjs__rspack_import_4 = __webpack_require__("./src/legacy.cjs");
/* import */ var _legacy_cjs__rspack_import_4_default = /*#__PURE__*/__webpack_require__.n(_legacy_cjs__rspack_import_4);
/* import */ var _legacy_reexport_js__rspack_import_5 = __webpack_require__("./src/legacy-reexport.js");
/* import */ var _context_consumer_js__rspack_import_6 = __webpack_require__("./src/context-consumer.js");
/* import */ var _meta_js__rspack_import_7 = __webpack_require__("./src/meta.js");
/* import */ var _path_consumer_cjs__rspack_import_8 = __webpack_require__("./src/path-consumer.cjs");










const decoder = new TextDecoder();

async function main() {
  const first = (0,_counter_js__rspack_import_2.inc)();
  const lazy = await __webpack_require__.e(/* import() */ "src_lazy_js").then(__webpack_require__.bind(__webpack_require__, "./src/lazy.js"));
  const tla = await __webpack_require__.e(/* import() */ "src_tla_js").then(__webpack_require__.bind(__webpack_require__, "./src/tla.js"));
  const requireConsumer = await __webpack_require__.e(/* import() */ "src_require-consumer_cjs").then(__webpack_require__.t.bind(__webpack_require__, "./src/require-consumer.cjs", 19));
  const featureB = await (0,_context_consumer_js__rspack_import_6.loadFeatureAsync)("./feature-b.js");

  const legacyNamedKey = ["named"][0];
  const legacyExtraKey = ["extra"][0];

  const summary = {
    message: (0,_message_js__rspack_import_3.formatMessage)("complex case"),
    pathBase: node_path__rspack_import_0_default().basename("/tmp/complex-case.txt"),
    bytes: decoder.decode(_fixtures_payload_bin__rspack_import_1).trimEnd(),
    counter: `${_counter_js__rspack_import_2.snapshot}->${first}->${_counter_js__rspack_import_2.current}->${_counter_js__rspack_import_2["default"].current}`,
    legacyDefaultKeys: Object.keys((_legacy_cjs__rspack_import_4_default())).sort().join(","),
    legacyStar: `${_legacy_reexport_js__rspack_import_5[legacyNamedKey]}:${_legacy_reexport_js__rspack_import_5[legacyExtraKey]}:${_legacy_reexport_js__rspack_import_5.legacyDefault.kind}`,
    features: (0,_context_consumer_js__rspack_import_6.loadFeatures)(),
    featureB,
    lazy: `${lazy.lazyValue}:${lazy.default()}`,
    tla: `${tla.default}:${tla.upper}`,
    requireConsumer: `${requireConsumer.readViaRequire()}:${requireConsumer.requireType}`,
    metaTail: _meta_js__rspack_import_7.metaUrl.split("/").slice(-2).join("/"),
    metaProtocol: _meta_js__rspack_import_7.metaProtocol,
    pathTails: `${_path_consumer_cjs__rspack_import_8.paths.dirnameTail}:${_path_consumer_cjs__rspack_import_8.paths.filenameTail}`,
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});




},
"./src/features/feature-a.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (__rspack_default_export),
  name: () => (name)
});
const name = "feature-a";
/* export default */ const __rspack_default_export = ("A");


},
"./src/features/feature-b.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (__rspack_default_export),
  name: () => (name)
});
const name = "feature-b";
/* export default */ const __rspack_default_export = ("B");


},
"./src/features sync feature-[ab]\\.js$"(module, __unused_rspack_exports, __webpack_require__) {
var map = {
  "./feature-a.js": "./src/features/feature-a.js",
  "./feature-b.js": "./src/features/feature-b.js"
};


function __rspack_context(req) {
  var id = __rspack_context_resolve(req);
  return __webpack_require__(id);
}
function __rspack_context_resolve(req) {
  if(!__webpack_require__.o(map, req)) {
    var e = new Error("Cannot find module '" + req + "'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
  }
  return map[req];
}
__rspack_context.keys = () => (Object.keys(map));
__rspack_context.resolve = __rspack_context_resolve;
module.exports = __rspack_context;
__rspack_context.id = "./src/features sync feature-[ab]\\.js$";


},
"./src/legacy-reexport.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  legacyDefault: () => (/* reexport default from dynamic */ _legacy_cjs__rspack_import_0_default.a)
});
/* import */ var _legacy_cjs__rspack_import_0 = __webpack_require__("./src/legacy.cjs");
/* import */ var _legacy_cjs__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(_legacy_cjs__rspack_import_0);

/* reexport */ var __rspack_reexport = {};
/* reexport */ for( const __rspack_import_key in _legacy_cjs__rspack_import_0) if(["default","legacyDefault"].indexOf(__rspack_import_key) < 0) __rspack_reexport[__rspack_import_key] =() => _legacy_cjs__rspack_import_0[__rspack_import_key]
/* reexport */ __webpack_require__.d(__webpack_exports__, __rspack_reexport);




},
"./src/message.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (defaultMessage),
  formatMessage: () => (formatMessage)
});
function formatMessage(name) {
  return `compiled by ${name}`;
}

function defaultMessage(name) {
  return `default:${name}`;
}


},
"./src/meta.js"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
"use strict";
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  metaProtocol: () => (metaProtocol),
  metaUrl: () => (metaUrl)
});
const metaUrl = 'file:///home/yj/github/runtime/cases/complex/src/meta.js';
const metaProtocol = new URL(metaUrl).protocol;


},
"./src/fixtures/payload.bin"(module, __unused_rspack_exports, __webpack_require__) {
"use strict";
module.exports = __webpack_require__.tb("cGF5bG9hZC1ieXRlcwo=");

},
"node:path"(module) {
"use strict";
module.exports = require("node:path");

},
"./src/legacy.cjs"(module) {
const secret = "legacy";

module.exports = {
  kind: "commonjs",
  named: `named-${secret}`,
  default: { from: "legacy-default-property" },
  extra: "legacy-extra",
  describe(prefix) {
    return `${prefix}:${this.kind}:${this.named}`;
  },
};


},
"./src/path-consumer.cjs"(__unused_rspack_module, exports) {
exports.paths = {
  dirnameTail: __dirname.split(/[\\/]/).slice(-2).join("/"),
  filenameTail: __filename.split(/[\\/]/).slice(-2).join("/"),
};


},

};
// load runtime
var __webpack_require__ = require("./runtime.js");
__webpack_require__.C(exports)
var __webpack_exec__ = function(moduleId) { return __webpack_require__(__webpack_require__.s = moduleId) }
var __webpack_exports__ = __webpack_require__.X(0, [], function() {
        return __webpack_exec__("./src/entry.js");
      });

})();