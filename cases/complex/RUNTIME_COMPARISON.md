# Rspack Runtime 与 Turbopack Runtime 对比报告：complex case

本文基于 `cases/complex` 的两套产物对比：

## Turbopack

```text
dist/[turbopack]_runtime.js
dist/entry.entry.js
dist/[root-of-the-server]__1_93xek._.js
dist/src_lazy_18swte0.js
dist/src_tla_0qr3_jl.js
dist/src_require-consumer_cjs_01j0mvk._.js
```

## Rspack

```text
rspack-dist/runtime.js
rspack-dist/entry.js
rspack-dist/src_lazy_js.js
rspack-dist/src_tla_js.js
rspack-dist/src_require-consumer_cjs.js
```

---

## 1. 核心结论

一句话：

> Rspack runtime 是 webpack-compatible 的 `__webpack_require__` 模块系统；Turbopack runtime 是以 `Context` / `__turbopack_context__` 为中心的自定义模块执行环境。

在 complex case 中，两者都覆盖了：

- ESM import/export；
- CJS interop；
- dynamic import 分包；
- top-level await；
- require.context；
- asset bytes；
- Node builtin external；
- `import.meta.url`。

但实现路径差异很明显。

---

## 2. 启动模型对比

### Rspack

`rspack-dist/entry.js`：

```js
exports.ids = ["entry"];
exports.modules = { ... };

var __webpack_require__ = require("./runtime.js");
__webpack_require__.C(exports)
var __webpack_exports__ = __webpack_require__.X(0, [], function() {
  return __webpack_require__("./src/entry.js");
});
```

模型：

```text
entry chunk 自己先加载
  -> require runtime
  -> 调用 C(exports) 把自己安装进 runtime
  -> X 启动入口模块
```

### Turbopack

`dist/entry.entry.js`：

```js
var R = require("./[turbopack]_runtime.js")("entry.entry.js")
R.c("[root-of-the-server]__1_93xek._.js")
R.m("[project]/src/entry.js [client] (ecmascript)")
```

模型：

```text
entry wrapper 加载 runtime
  -> runtime 通过 R.c 主动 require initial chunk
  -> runtime 通过 R.m 实例化入口模块
```

### 差异

| 阶段 | Rspack | Turbopack |
|---|---|---|
| runtime 对外对象 | `__webpack_require__` 函数 | `R = { c, m }` |
| initial chunk 安装 | `__webpack_require__.C(exports)` | `R.c(chunkPath)` |
| 入口执行 | `__webpack_require__.X` + `__webpack_require__(entryId)` | `R.m(entryModuleId)` |
| 驱动方向 | chunk 自安装 | runtime 主动加载 chunk |

---

## 3. chunk 格式对比

### Rspack chunk

```js
exports.ids = ["entry"];
exports.modules = {
  "./src/entry.js": factory,
  "./src/counter.js": factory,
  ...
};
```

抽象结构：

```ts
type RspackChunk = {
  ids: string[];
  modules: Record<string, ModuleFactory>;
  runtime?: (require) => void;
}
```

### Turbopack chunk

```js
module.exports = [
  "[project]/src/counter.js [client] (ecmascript)", factory,
  "[project]/src/legacy.cjs [client] (ecmascript)", factory,
  ...
]
```

抽象结构：

```ts
type TurbopackChunk = Array<ModuleId | ModuleFactory>
```

### 对比

| 维度 | Rspack | Turbopack |
|---|---|---|
| chunk 数据结构 | 对象：`ids/modules/runtime` | 压缩数组：`id/factory/id/factory` |
| 可读性 | 更高 | 更紧凑 |
| 安装函数 | `installChunk` | `installCompressedModuleFactories` |
| scope hoisting / merged modules | 主要由模块 factory 和优化处理 | chunk 格式天然支持多个 id 指向同一 factory |

---

## 4. 模块 factory 形态

### Rspack

```js
"./src/counter.js"(module, exports, __webpack_require__) {
  __webpack_require__.r(exports);
  __webpack_require__.d(exports, {
    current: () => current,
    inc: () => inc
  });
}
```

### Turbopack

```js
"[project]/src/counter.js [client] (ecmascript)", ((__turbopack_context__) => {
  __turbopack_context__.s([
    "current", () => current,
    "inc", 0, inc
  ]);
})
```

### 对比

| 维度 | Rspack | Turbopack |
|---|---|---|
| factory 参数 | `(module, exports, __webpack_require__)` | `(__turbopack_context__, module, exports)` |
| 模块加载入口 | `__webpack_require__` | `context.i` / `context.r` |
| ESM export helper | `r` + `d` | `s` |
| context 感知 | 依赖 `__webpack_require__` 全局函数对象 | 每个模块拿到独立 context |

---

## 5. ESM export 对比

| 功能 | Rspack | Turbopack |
|---|---|---|
| 标记 ESM | `__webpack_require__.r(exports)` | `context.s(...)` 内部完成 |
| 定义 named export | `__webpack_require__.d(exports, getters)` | `context.s(bindings)` |
| live binding | getter | getter |
| 直接值导出 | `d(..., values)` 可支持 | `BindingTag_Value = 0` |
| 是否 seal exports | 当前 Rspack 产物没有 | Turbopack `esm()` 会 `Object.seal(exports)` |

Turbopack 的 `s` 更紧凑；Rspack 的 `r` + `d` 更接近 webpack 心智。

---

## 6. ESM/CJS interop 对比

### Rspack

CJS default import：

```js
var legacy = __webpack_require__("./src/legacy.cjs");
var legacy_default = __webpack_require__.n(legacy);
```

dynamic import CJS：

```js
__webpack_require__.e("src_require-consumer_cjs")
  .then(__webpack_require__.t.bind(__webpack_require__, "./src/require-consumer.cjs", 19))
```

### Turbopack

ESM import CJS：

```js
var legacy = __turbopack_context__.i("[project]/src/legacy.cjs [client] (ecmascript)")
```

CJS require：

```js
const legacy = __turbopack_context__.r("[project]/src/legacy.cjs [client] (ecmascript)")
```

### 对比

| 场景 | Rspack | Turbopack |
|---|---|---|
| ESM import CJS | `__webpack_require__` + `n`/`t` 等 helper | `context.i` 内置 `interopEsm` 路径 |
| CJS require 内部模块 | `__webpack_require__(id)` | `context.r(id)` |
| default interop | `__webpack_require__.n` | `interopEsm` 生成 namespace default |
| fake namespace | `__webpack_require__.t` | `interopEsm` / `createNS` |

Rspack 把 interop 分散在多个 webpack-compatible helper；Turbopack 把 ESM import 与 CJS require 分成两个明确 API。

---

## 7. `export * from CJS` 对比

源码：

```js
export * from "./legacy.cjs";
export { default as legacyDefault } from "./legacy.cjs";
```

### Rspack

Rspack 生成 reexport loop：

```js
var __rspack_reexport = {};
for (const key in legacy) {
  if (["default", "legacyDefault"].indexOf(key) < 0) {
    __rspack_reexport[key] = () => legacy[key]
  }
}
__webpack_require__.d(__webpack_exports__, __rspack_reexport);
```

### Turbopack

Turbopack 生成：

```js
__turbopack_context__.s([
  "legacyDefault", () => legacyNamespace["default"]
]);
__turbopack_context__.j(legacyNamespace);
```

`j` 用 Proxy 做动态 re-export。

### 对比

| 维度 | Rspack | Turbopack |
|---|---|---|
| 策略 | 构建 reexport getter map | Proxy 动态委托 |
| helper | `d` | `j` |
| 适合场景 | 枚举当前 raw object key | 延迟/动态读取 re-exported object |

---

## 8. require.context 对比

### Rspack

生成一个 context module：

```js
var map = {
  "./feature-a.js": "./src/features/feature-a.js",
  "./feature-b.js": "./src/features/feature-b.js"
};

function __rspack_context(req) {
  var id = __rspack_context_resolve(req);
  return __webpack_require__(id);
}
__rspack_context.keys = () => Object.keys(map);
__rspack_context.resolve = __rspack_context_resolve;
module.exports = __rspack_context;
```

### Turbopack

生成一个 map module：

```js
context.v({
  "./feature-a.js": {
    id: () => "...feature-a.js...",
    module: () => context.r("...feature-a.js...")
  }
})
```

业务模块中：

```js
const featureContext = context.f(context.r("...require.context map module..."))
```

### 对比

| 维度 | Rspack | Turbopack |
|---|---|---|
| context 创建 | synthetic module 直接导出 function | synthetic map module + `context.f(map)` |
| `.keys()` | 支持 | 支持 |
| `.resolve()` | 支持 | 支持 |
| `.import()` | 当前 Rspack 产物没有 | Turbopack 有 |
| query/hash | 当前 Rspack context 不剥离 | Turbopack `parseRequest` 会剥离 |

---

## 9. dynamic import 对比

源码：

```js
await import("./lazy.js")
await import("./tla.js")
await import("./require-consumer.cjs")
```

### Rspack

```js
await __webpack_require__.e("src_lazy_js")
  .then(__webpack_require__.bind(__webpack_require__, "./src/lazy.js"));
```

链路：

```text
e(chunkId)
  -> f.require(chunkId)
    -> require("./" + u(chunkId))
    -> C(chunk)
  -> __webpack_require__(moduleId)
```

### Turbopack

```js
await __turbopack_context__.A("[project]/src/lazy.js ... async loader")
```

loader module：

```js
context.v((parentImport) => {
  return Promise.all(["src_lazy_18swte0.js"].map(chunk => context.l(chunk)))
    .then(() => parentImport("[project]/src/lazy.js ..."));
});
```

链路：

```text
A(loaderId)
  -> r(loaderId)
  -> loader(parentImport)
    -> l(chunkPath)
    -> parentImport(realModuleId)
```

### 对比

| 维度 | Rspack | Turbopack |
|---|---|---|
| ensure chunk API | `__webpack_require__.e` | `context.l` |
| loader 表达 | 直接在 import 处 `e().then(require)` | 额外生成 async loader module，通过 `A` 调用 |
| chunk id -> filename | `u(chunkId)` | chunk path 直接写入 loader module |
| CJS dynamic import | `t(..., mode)` | async loader + `parentImport` + `i` interop |

---

## 10. top-level await 对比

两者都有 async module runtime。

| 维度 | Rspack | Turbopack |
|---|---|---|
| API | `__webpack_require__.a(module, body, hasAwait)` | `__turbopack_context__.a(body, hasAwait)` |
| 私有状态 | `rspackQueues`, `rspackExports`, `rspackError` 等 symbol | `turbopackQueues`, `turbopackExports`, `turbopackError` 等 symbol |
| module.exports | 变成 Promise-like | 变成 Promise-like，同时 namespaceObject 也通过 accessor 指向 promise |
| 来源 | webpack-compatible async module runtime | 注释中也说明借鉴 webpack async runtime |

这部分两者非常相似，差异主要在挂载位置和内部命名。

---

## 11. asset bytes 对比

| 维度 | Rspack | Turbopack |
|---|---|---|
| 源码 | `with { type: "bytes" }` | 同左 |
| helper | `__webpack_require__.tb(base64)` | `[turbopack]/shared/base64.ts` 的 `base64Decode` |
| 导出 | CJS `module.exports = Uint8Array` | ESM default export |
| base64 解码 | `Buffer.from(base64, 'base64')` | 优先 `Uint8Array.fromBase64`，否则 `atob` fallback |

---

## 12. Node external 对比

源码：

```js
import path from "node:path";
```

| 维度 | Rspack | Turbopack |
|---|---|---|
| 产物 | external module factory：`module.exports = require("node:path")` | `context.x("node:path", () => require("node:path"), true)` |
| default interop | `__webpack_require__.n` | `externalRequire` 内部可 `interopEsm` |
| 失败错误包装 | 当前 external factory 直接抛 Node require 错误 | `Failed to load external module ...` |

---

## 13. `import.meta.url` 与 CJS 路径对比

| 场景 | Rspack | Turbopack |
|---|---|---|
| `import.meta.url` | 编译成绝对 file URL 字符串 | 运行时调用 `context.F("src/meta.js")` |
| CJS `__dirname` / `__filename` | 使用 bundle 文件的 Node 值 | 编译期替换为 `/ROOT/src` 和 `/ROOT/src/path-consumer.cjs` |

所以两者运行输出中 `pathTails` 不同：

```text
Turbopack: ROOT/src:src/path-consumer.cjs
Rspack:    complex/rspack-dist:rspack-dist/entry.js
```

这反映了两者对“模块原始路径语义”的处理差异。

---

## 14. runtime 体积对比

当前文件行数：

| 文件 | 行数 | 大致大小 |
|---|---:|---:|
| Turbopack `dist/[turbopack]_runtime.js` | 897 | 33.9 KB |
| Rspack `rspack-dist/runtime.js` | 270 | 8.5 KB |

不能简单理解成 Rspack 永远更小。当前差异主要来自生成策略：

- Rspack runtime modules 更按需，complex case 触发了 async、interop、chunk、binary 等 helper 后才变大；
- Turbopack Node runtime 当前更像预置完整能力的通用 runtime，basic 和 complex 的 `[turbopack]_runtime.js` 大小基本相同。

---

## 15. API 对照表

| 功能 | Rspack | Turbopack |
|---|---|---|
| 启动加载 runtime | `require("./runtime.js")` | `require("./[turbopack]_runtime.js")(sourcePath)` |
| 安装 initial chunk | `__webpack_require__.C(exports)` | `R.c(chunkPath)` |
| 执行 entry module | `__webpack_require__.X(...); __webpack_require__(entryId)` | `R.m(entryModuleId)` |
| 模块工厂表 | `__webpack_require__.m` / `__webpack_modules__` | `moduleFactories` / `context.M` |
| 模块缓存 | `__webpack_module_cache__` | `moduleCache` / `context.c` |
| ESM import | `__webpack_require__(id)` | `context.i(id)` |
| CJS require | `__webpack_require__(id)` | `context.r(id)` |
| ESM export | `r` + `d` | `s` |
| CJS default interop | `n` | `interopEsm` via `i` / `x` |
| fake namespace | `t` | `interopEsm` / `createNS` |
| dynamic re-export | reexport loop + `d` | `j` Proxy |
| require.context | synthetic context module | synthetic map module + `f` |
| dynamic import chunk load | `e` + `f.require` + `u` | `A` + loader module + `l` |
| top-level await | `a` | `a` |
| bytes asset | `tb` | base64 helper module |
| Node external | external module factory | `x` |
| `import.meta.url` | compile-time file URL string | `F(modulePath)` |

---

## 16. 总结

### Rspack runtime 更像：

```text
webpack-compatible require runtime
  + 按需注入 runtime modules
  + chunk 自安装
  + dynamic import 通过 e/f/u/C 链路加载 chunk
```

### Turbopack runtime 更像：

```text
通用模块执行环境
  + 每个模块拿到 Context
  + import/require/export 是 context 上的明确 API
  + startup wrapper 主动加载 chunk
  + dynamic import 通过 async loader module 表达
```

如果继续用 webpack 心智类比：

```text
Turbopack R.c/loadRuntimeChunk  ≈ Rspack __webpack_require__.C/installChunk
Turbopack context.l/loadChunkAsync ≈ Rspack __webpack_require__.e + f.require
Turbopack context.s ≈ Rspack __webpack_require__.r + d
Turbopack context.i/r ≈ Rspack __webpack_require__ + interop helpers
```
