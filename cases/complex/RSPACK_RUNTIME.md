# Rspack Runtime 分析报告：complex case

本文基于 `cases/complex` 的 Rspack 产物分析：

- `rspack-dist/runtime.js`
- `rspack-dist/entry.js`
- `rspack-dist/src_lazy_js.js`
- `rspack-dist/src_tla_js.js`
- `rspack-dist/src_require-consumer_cjs.js`

当前 Rspack 配置：

```js
mode: "development",
target: "node",
optimization: {
  minimize: false,
  runtimeChunk: "single"
},
experiments: {
  topLevelAwait: true
}
```

因此 runtime 被拆到独立的 `runtime.js`，entry chunk 通过 `require("./runtime.js")` 加载 runtime，然后调用 `__webpack_require__.C(exports)` 安装自己。

---

## 1. complex case 覆盖的 Rspack runtime 场景

| 源码场景 | 源码文件 | Rspack runtime 体现 |
|---|---|---|
| ESM export | `counter.js`, `message.js` | `__webpack_require__.r` + `__webpack_require__.d` |
| ESM import | `entry.js`, `lazy.js`, `tla.js` | `__webpack_require__(id)` |
| CJS default interop | `legacy.cjs`, `node:path` | `__webpack_require__.n` |
| dynamic namespace object | dynamic import CJS | `__webpack_require__.t` |
| dynamic import chunk loading | `import("./lazy.js")` 等 | `__webpack_require__.e` + `f.require` + `u` |
| top-level await | `tla.js` | `__webpack_require__.a` |
| require.context | `context-consumer.js` | synthetic context module |
| asset bytes | `payload.bin` | `__webpack_require__.tb` |
| Node builtin external | `node:path` | external module factory: `module.exports = require("node:path")` |
| startup entrypoint | `entry.js` tail | `__webpack_require__.C` + `X` |

当前 `runtime.js` 包含的主要 helper：

```text
m a aE zS zT n t d f e u o r X tb C
```

---

## 2. 产物拓扑

```text
rspack-dist/
  runtime.js                    # 独立 webpack-compatible runtime
  entry.js                      # entry chunk，自带 modules，启动时安装自己
  src_lazy_js.js                # dynamic import: lazy.js
  src_tla_js.js                 # dynamic import: tla.js, 含 top-level await
  src_require-consumer_cjs.js   # dynamic import: require-consumer.cjs
```

`entry.js` 结构：

```js
exports.ids = ["entry"];
exports.modules = {
  "./src/entry.js": factory,
  "./src/counter.js": factory,
  ...
};

var __webpack_require__ = require("./runtime.js");
__webpack_require__.C(exports)
var __webpack_exec__ = function(moduleId) {
  return __webpack_require__(__webpack_require__.s = moduleId)
}
var __webpack_exports__ = __webpack_require__.X(0, [], function() {
  return __webpack_exec__("./src/entry.js");
});
```

---

## 3. `__webpack_require__`：模块系统核心

`runtime.js` 中的核心函数：

```js
function __webpack_require__(moduleId) {
  var cachedModule = __webpack_module_cache__[moduleId];
  if (cachedModule !== undefined) {
    return cachedModule.exports;
  }

  var module = (__webpack_module_cache__[moduleId] = {
    exports: {}
  });

  __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  return module.exports;
}
```

对应两个核心表：

```js
var __webpack_modules__ = ({});
var __webpack_module_cache__ = {};
```

| 结构 | 作用 |
|---|---|
| `__webpack_modules__` | module id -> factory |
| `__webpack_module_cache__` | module id -> `{ exports }` |
| `__webpack_require__.m` | 暴露 `__webpack_modules__` 给 chunk 安装逻辑 |

模块先进入 cache 再执行 factory，因此支持循环依赖。

---

## 4. chunk 安装：`C` / `installChunk`

`runtime.js` 内部：

```js
var installChunk = (chunk) => {
  var moreModules = chunk.modules,
      chunkIds = chunk.ids,
      runtime = chunk.runtime;

  for (var moduleId in moreModules) {
    if (__webpack_require__.o(moreModules, moduleId)) {
      __webpack_require__.m[moduleId] = moreModules[moduleId];
    }
  }

  if (runtime) runtime(__webpack_require__);

  for (var i = 0; i < chunkIds.length; i++) {
    installedChunks[chunkIds[i]] = 1;
  }
};

__webpack_require__.C = installChunk;
```

`entry.js` 调用：

```js
__webpack_require__.C(exports)
```

因为 entry chunk 自己先把 `exports.ids` 和 `exports.modules` 写好了，所以这一步相当于“entry chunk 自安装”。

---

## 5. startup：`X`

`__webpack_require__.X(result, chunkIds, fn)`：

```js
__webpack_require__.X = (result, chunkIds, fn) => {
  var moduleId = chunkIds;
  if (!fn) chunkIds = result, fn = () => (__webpack_require__(__webpack_require__.s = moduleId))
  chunkIds.map(__webpack_require__.e, __webpack_require__)
  var r = fn();
  return r === undefined ? result : r;
}
```

当前调用：

```js
__webpack_require__.X(0, [], function() {
  return __webpack_exec__("./src/entry.js");
});
```

因为 `chunkIds` 是空数组，所以不需要额外 ensure chunk，直接执行入口模块。

---

## 6. ESM export：`r` + `d`

`counter.js` 产物：

```js
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  current: () => current,
  "default": () => (__rspack_default_export),
  inc: () => inc,
  snapshot: () => snapshot
});
```

其中：

- `r(exports)`：标记 ESM namespace：`__esModule` + `Symbol.toStringTag`；
- `d(exports, getters, values)`：定义 enumerable getter/value 属性。

这和 webpack runtime 心智完全一致。

---

## 7. CJS default interop：`n`

入口里：

```js
var node_path = __webpack_require__("node:path");
var node_path_default = __webpack_require__.n(node_path);

var legacy = __webpack_require__("./src/legacy.cjs");
var legacy_default = __webpack_require__.n(legacy);
```

`n(module)` 逻辑：

```js
var getter = module && module.__esModule
  ? () => module['default']
  : () => module;
__webpack_require__.d(getter, { a: getter });
return getter;
```

也就是说：

- 如果是 ESM，default getter 返回 `module.default`；
- 如果是 CJS，default getter 返回整个 `module.exports`。

---

## 8. fake namespace：`t`

dynamic import 一个 CJS 模块时，Rspack 生成：

```js
const requireConsumer = await __webpack_require__.e("src_require-consumer_cjs")
  .then(__webpack_require__.t.bind(__webpack_require__, "./src/require-consumer.cjs", 19));
```

`__webpack_require__.t(value, mode)` 会创建 fake namespace object。

这里的 mode `19` 可以拆成：

```text
19 = 16 + 2 + 1
```

含义：

| bit | 含义 |
|---|---|
| `1` | value 是 module id，先 require 它 |
| `2` | 把 value 的属性合并进 namespace |
| `16` | Promise-like 时直接返回 |

因此 dynamic import CJS 能得到类似 ESM namespace 的对象。

---

## 9. dynamic import：`e` + `f.require` + `u`

源码：

```js
await import("./lazy.js")
await import("./tla.js")
await import("./require-consumer.cjs")
```

产物：

```js
await __webpack_require__.e("src_lazy_js")
  .then(__webpack_require__.bind(__webpack_require__, "./src/lazy.js"));
```

runtime 链路：

```text
__webpack_require__.e(chunkId)
  -> 遍历 __webpack_require__.f
    -> f.require(chunkId, promises)
      -> require("./" + __webpack_require__.u(chunkId))
      -> installChunk(chunk)
```

`u(chunkId)` 在当前配置下返回：

```js
return "" + chunkId + ".js"
```

所以 chunk id `src_lazy_js` 对应文件：

```text
rspack-dist/src_lazy_js.js
```

---

## 10. top-level await：`a`

`tla.js` 产物位于 `src_tla_js.js`：

```js
__webpack_require__.a(module, async function (loadAsyncDeps, asyncDone) {
  try {
    __webpack_require__.r(__webpack_exports__);
    __webpack_require__.d(__webpack_exports__, { ... });
    const awaited = await Promise.resolve(...);
    asyncDone();
  } catch(e) {
    asyncDone(e);
  }
}, 1);
```

`a(module, body, hasAwait)` 的作用：

- 把 `module.exports` 变成 Promise-like async module；
- 通过 queue 追踪 async dependency；
- resolve/reject top-level await；
- 保留 ESM exports。

Rspack 的 async module runtime 与 webpack 的 async module runtime 设计非常接近。

---

## 11. require.context synthetic module

源码：

```js
const featureContext = require.context("./features", false, /feature-[ab]\.js$/);
```

产物中出现一个 synthetic module：

```js
"./src/features sync feature-[ab]\\.js$"(module, exports, __webpack_require__) {
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

  __rspack_context.keys = () => Object.keys(map);
  __rspack_context.resolve = __rspack_context_resolve;
  module.exports = __rspack_context;
}
```

与 Turbopack 不同，当前 Rspack context function 不提供 `.import()`，也不会自动去掉 query/hash。因此源码里为了兼容两边，写了：

```js
const mod = featureContext.import
  ? await featureContext.import(requestWithQueryAndHash)
  : featureContext(key);
```

---

## 12. asset bytes：`tb`

源码：

```js
import payloadBytes from "./fixtures/payload.bin" with { type: "bytes" };
```

产物：

```js
module.exports = __webpack_require__.tb("cGF5bG9hZC1ieXRlcwo=");
```

`tb` 是 to binary helper：

```js
__webpack_require__.tb = (base64) => new Uint8Array(Buffer.from(base64, 'base64'))
```

---

## 13. Node builtin external

`node:path` 被生成为普通 external module factory：

```js
"node:path"(module) {
  module.exports = require("node:path");
}
```

入口再通过 `__webpack_require__.n` 做 default interop：

```js
node_path_default().basename(...)
```

---

## 14. `import.meta.url` 与 CJS 路径值

`meta.js` 中的 `import.meta.url` 在 Rspack 产物里被直接编译成绝对 file URL 字符串：

```js
const metaUrl = 'file:///home/yj/github/runtime/cases/complex/src/meta.js';
```

`path-consumer.cjs` 中的 `__dirname` / `__filename` 没有还原成原源码模块路径，而是使用当前 bundle 文件的 Node 值。因此运行输出中 Rspack 的 `pathTails` 是：

```text
complex/rspack-dist:rspack-dist/entry.js
```

这和 Turbopack 的 `/ROOT/src` 编译期替换不同。


---

## 15. `__webpack_require__.f` 多 handler 验证：JS + CSS chunk

为了验证“什么时候会注册多个 `__webpack_require__.f.*`”，本 case 额外新增了一个 browser/CSS 专用构建：

- 配置：`rspack.multi-f.config.cjs`
- 入口：`src/multi-f-entry.js`
- lazy 模块：`src/styled-feature.js`
- CSS：`src/styles/styled-feature.css`
- 输出：`rspack-multi-f-dist/`
- 验证脚本：`scripts/verify-multiple-f.cjs`

源码关系：

```js
// multi-f-entry.js
await import("./styled-feature.js")

// styled-feature.js
import "./styles/styled-feature.css";
export const styledFeature = "styled-feature-loaded";
```

这个构建使用 browser target 和 CSS modules experiment：

```js
target: "web",
experiments: { css: true },
module: {
  rules: [{ test: /\.css$/, type: "css" }]
}
```

构建后会生成：

```text
rspack-multi-f-dist/runtime.js
rspack-multi-f-dist/multi-f-entry.js
rspack-multi-f-dist/src_styled-feature_js.js
rspack-multi-f-dist/src_styled-feature_js.css
```

关键验证点在 `rspack-multi-f-dist/runtime.js`：

```js
__webpack_require__.f.css = (chunkId, promises, fetchPriority) => {
  // css chunk loading
};

__webpack_require__.f.j = function (chunkId, promises) {
  // JSONP chunk loading for javascript
};
```

也就是说，同一个 dynamic import chunk `src_styled-feature_js` 需要两个子系统参与 ensure：

```text
__webpack_require__.e("src_styled-feature_js")
  -> f.css(...)  加载 src_styled-feature_js.css
  -> f.j(...)    加载 src_styled-feature_js.js
  -> Promise.all(promises)
```

入口产物中 dynamic import 仍然是统一入口：

```js
const mod = await __webpack_require__.e("src_styled-feature_js")
  .then(__webpack_require__.bind(__webpack_require__, "./src/styled-feature.js"));
```

这正是 `__webpack_require__.f` 的设计价值：`e(chunkId)` 不需要知道一个 chunk 关联了 JS、CSS 还是其他资源；它只遍历所有已注册的 handler，并等待它们共同完成。

验证命令：

```bash
pnpm --dir cases/complex run verify:multi-f
```

当前验证输出：

```text
verified __webpack_require__.f handlers: css, j
verified lazy JS and CSS assets exist
```

---

## 16. 总结

当前 complex case 下，Rspack runtime 的关键链路是：

```text
entry.js
  -> require("./runtime.js")
  -> __webpack_require__.C(exports) 安装 entry chunk
  -> __webpack_require__.X(...)
    -> __webpack_require__("./src/entry.js")
      -> r/d/n/tb/context module
      -> dynamic import: e -> f.require -> u -> C
      -> top-level await: a
```

与 basic case 相比，complex case 额外触发了：

- async module runtime：`a`；
- CJS interop：`n` / `t`；
- dynamic chunk loading：`e` / `f.require` / `u`；
- binary asset helper：`tb`；
- require.context synthetic module；
- external module factory。
