# Turbopack Runtime 分析报告：complex case

本文基于 `cases/complex` 的 Turbopack Node 产物分析：

- `dist/[turbopack]_runtime.js`
- `dist/entry.entry.js`
- `dist/[root-of-the-server]__1_93xek._.js`
- `dist/src_lazy_18swte0.js`
- `dist/src_tla_0qr3_jl.js`
- `dist/src_require-consumer_cjs_01j0mvk._.js`

> 文件名里的 hash 可能随源码变化而变化。当前文档对应最后一次构建产物。

---

## 1. complex case 覆盖的 runtime 场景

相比 `basic`，这个 case 故意覆盖了更多 runtime 路径：

| 源码场景 | 源码文件 | Turbopack runtime 体现 |
|---|---|---|
| ESM named/default export、live binding | `counter.js`, `message.js` | `__turbopack_context__.s` |
| ESM import ESM | `entry.js`, `lazy.js`, `tla.js` | `__turbopack_context__.i` |
| ESM import CJS / CJS interop | `entry.js -> legacy.cjs` | `i` + `interopEsm` |
| CJS `require()` 内部模块 | `require-consumer.cjs` | `__turbopack_context__.r` |
| `export * from CJS` 动态 re-export | `legacy-reexport.js` | `__turbopack_context__.j` |
| `require.context` | `context-consumer.js` | synthetic context map + `v` + `r` + `f` |
| dynamic `import()` | `entry.js` | async loader module + `A` + `v` + `l` |
| top-level await | `tla.js` | `__turbopack_context__.a` |
| asset bytes | `payload.bin` with `{ type: "bytes" }` | base64 helper module + `i` + `s` |
| Node builtin external | `import path from "node:path"` | `__turbopack_context__.x` |
| `import.meta.url` | `meta.js` | `__turbopack_context__.F` |
| CJS `__dirname` / `__filename` | `path-consumer.cjs` | 编译期替换为 `/ROOT/...` 占位路径 |

当前实际用到的 `__turbopack_context__` API：

```text
s i r v j f A l a F x
```

runtime 文件里还包含但此 case 未实际触发的能力包括：`n`、`q`、`R`、`P`、`L`、`w`、`u`、`b`、`y`、`z`、`U`、`C` 等。

---

## 2. 产物拓扑

当前构建后的文件：

```text
dist/
  [turbopack]_runtime.js                    # 通用 Node runtime
  entry.entry.js                            # 启动 wrapper
  [root-of-the-server]__1_93xek._.js        # initial/main chunk
  src_lazy_18swte0.js                       # dynamic import: lazy.js
  src_tla_0qr3_jl.js                        # dynamic import: tla.js, 含 top-level await
  src_require-consumer_cjs_01j0mvk._.js     # dynamic import: require-consumer.cjs
```

启动文件 `entry.entry.js`：

```js
var R = require("./[turbopack]_runtime.js")("entry.entry.js")
R.c("[root-of-the-server]__1_93xek._.js")
R.m("[project]/src/entry.js [client] (ecmascript)")
module.exports = R.m("[project]/src/entry.js [client] (ecmascript)").exports
```

这仍然是 Turbopack 的典型 Node 启动模型：

```text
加载 runtime
  -> R.c(initial chunk) 注册 initial chunk 的 module factories
  -> R.m(entry module id) 实例化入口模块
```

---

## 3. `R.c`：启动阶段加载 initial chunk

`R.c` 对应 runtime 内部的 `loadRuntimeChunk(sourcePath, chunkData)`。

当前 case 中：

```js
R.c("[root-of-the-server]__1_93xek._.js")
```

它做的事情是：

1. 解析 chunk 路径；
2. Node runtime 下用 `require(resolved)` 读取 chunk；
3. 调用 `installCompressedModuleFactories`；
4. 把 chunk 中的模块 id -> factory 注册进 `moduleFactories`；
5. 记录到 `loadedChunks`，避免重复加载。

因此 `R.c` 很像 webpack/Rspack 启动阶段“安装 initial/entry chunk 的模块表”，但它不执行入口模块。真正执行入口模块的是后面的 `R.m`。

---

## 4. `R.m`：实例化入口模块

`R.m(id)` 对应 `getOrInstantiateRuntimeModule(sourcePath, id)`。

首次执行入口模块时，runtime 会：

```js
const moduleFactory = moduleFactories.get(id)
const module = createModuleWithDirection(id)
const exports = module.exports
moduleCache[id] = module
const context = new Context(module, exports)
moduleFactory(context, module, exports)
module.loaded = true
```

关键点：

- 模块执行前先进入 `moduleCache`，支持循环依赖；
- factory 抛错时写入 `module.error`，后续再次访问会继续抛出同一个错误；
- Node build runtime 使用 `ModuleWithDirection` 形状，即模块对象带 `parents` / `children` 字段。

---

## 5. 主 chunk 格式

`[root-of-the-server]__1_93xek._.js` 导出一个压缩数组：

```js
module.exports = [
  "[project]/src/counter.js [client] (ecmascript)", factory,
  "[project]/src/legacy.cjs [client] (ecmascript)", factory,
  ...
]
```

格式是：

```ts
type CompressedModuleFactories = Array<ModuleId | ModuleFactory>
```

`installCompressedModuleFactories` 会顺序扫描这个数组。它还支持多个 module id 共享一个 factory，用于 merged module / scope hoisting 场景。

---

## 6. ESM export：`s`

`counter.js` 产物：

```js
let current = 0;
const snapshot = current;
function inc() { current += 1; return current; }

__turbopack_context__.s([
  "current", () => current,
  "default", () => __TURBOPACK__default__export__,
  "inc", 0, inc,
  "snapshot", 0, snapshot
]);
```

`context.s(bindings)` 即 `esmExport`。它会：

1. 给 exports 加 `__esModule`；
2. 给 exports 加 `Symbol.toStringTag = "Module"`；
3. 根据 bindings 定义导出属性；
4. `Object.seal(exports)`。

bindings 有两种常见形式：

```js
["current", () => current]   // getter，支持 live binding
["inc", 0, inc]              // 0 是 BindingTag_Value，直接导出值
```

---

## 7. ESM import：`i`

入口模块里大量静态 ESM import 被编译成：

```js
var counter = __turbopack_context__.i("[project]/src/counter.js [client] (ecmascript)")
var legacy = __turbopack_context__.i("[project]/src/legacy.cjs [client] (ecmascript)")
```

`i` 的流程：

1. 调用 `getOrInstantiateModuleFromParent(id, this.m)`；
2. 如果模块还没执行，先实例化；
3. 如果目标已有 `namespaceObject`，直接返回；
4. 如果目标是 CJS，则调用 `interopEsm(raw, createNS(raw), raw.__esModule)` 包装成 ESM namespace。

因此在这个 case 里：

- `counter.js` 是 ESM，`i` 返回它的 namespace；
- `legacy.cjs` 是 CJS，`i` 会把 `module.exports` 包装成 ESM namespace，默认导出是 raw CJS 对象。

---

## 8. CJS require：`r`

`require-consumer.cjs` 产物：

```js
const legacy = __turbopack_context__.r("[project]/src/legacy.cjs [client] (ecmascript)");
const counter = __turbopack_context__.r("[project]/src/counter.js [client] (ecmascript)");
```

`r(id)` 即 `commonJsRequire`，返回目标模块的 `module.exports`：

```js
return getOrInstantiateModuleFromParent(id, this.m).exports
```

这和 `i` 的区别是：

| API | 返回值 |
|---|---|
| `i(id)` | ESM namespace object，必要时会做 CJS interop |
| `r(id)` | 原始 `module.exports` |

---

## 9. 直接导出值：`v`

本 case 中 `v` 出现在两类模块中。

### 9.1 `require.context` 的 synthetic map module

```js
__turbopack_context__.v({
  "./feature-a.js": {
    id: () => "[project]/src/features/feature-a.js [client] (ecmascript)",
    module: () => __turbopack_context__.r("[project]/src/features/feature-a.js [client] (ecmascript)")
  },
  ...
});
```

这里 `v` 等价于：

```js
module.exports = map
```

### 9.2 dynamic import loader module

dynamic import 会额外生成 async loader module：

```js
__turbopack_context__.v((parentImport) => {
  return Promise.all([
    "src_lazy_18swte0.js"
  ].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
    return parentImport("[project]/src/lazy.js [client] (ecmascript)");
  });
});
```

这里 `v` 把 loader 函数作为 `module.exports`。

---

## 10. 动态 re-export：`j`

`legacy-reexport.js`：

```js
export * from "./legacy.cjs";
export { default as legacyDefault } from "./legacy.cjs";
```

因为 `legacy.cjs` 的导出是运行时对象，Turbopack 无法完全静态枚举 `export *` 的所有 key，于是生成：

```js
__turbopack_context__.s([
  "legacyDefault",
  () => legacyNamespace["default"]
]);
__turbopack_context__.j(legacyNamespace);
```

`j(object)` 即 `dynamicExport`。它会把当前模块的 exports 包成 Proxy：

- 优先读当前 exports 上已有属性，例如 `legacyDefault`；
- 如果没有，再到被 re-export 的对象里查找；
- `default` 和 `__esModule` 有特殊处理；
- `ownKeys` 会尝试合并动态导出的 key。

本 case 中入口用动态 key 访问：

```js
legacyStar[legacyNamedKey]
legacyStar[legacyExtraKey]
```

从而真实走到 `j` 创建的动态 re-export proxy。

---

## 11. `require.context`：`f`

源码：

```js
const featureContext = require.context("./features", false, /feature-[ab]\.js$/);
```

Turbopack 分两步生成。

第一步，生成一个 synthetic map module，并通过 `v` 导出 map：

```js
{
  "./feature-a.js": {
    id: () => "...feature-a.js...",
    module: () => context.r("...feature-a.js...")
  },
  "./feature-b.js": { ... }
}
```

第二步，在业务模块中调用：

```js
const featureContext = __turbopack_context__.f(
  __turbopack_context__.r("[project]/src/context-consumer.js (require.context ./features/*)")
);
```

`f(map)` 返回的 context function 支持：

```js
featureContext("./feature-a.js")
featureContext.keys()
featureContext.resolve("./feature-a.js")
featureContext.import("./feature-a.js")
```

Turbopack 的 `moduleContext` 还会通过 `parseRequest` 去掉 query/hash，因此本 case 里的：

```js
featureContext("./feature-a.js?query=1#hash")
featureContext.import("./feature-b.js?via=import#fragment")
```

可以解析到同一个 context map key。

---

## 12. dynamic import：`A` + `l`

源码：

```js
const lazy = await import("./lazy.js");
const tla = await import("./tla.js");
const requireConsumer = await import("./require-consumer.cjs");
```

入口模块中生成：

```js
const lazy = await __turbopack_context__.A("[project]/src/lazy.js [client] (ecmascript, async loader)");
```

`A(moduleId)` 即 `asyncLoader`：

```js
const loader = this.r(moduleId)
return loader(esmImport.bind(this))
```

loader module 本身通过 `v` 导出一个函数，该函数：

1. 调用 `l(chunk)` 加载 lazy chunk；
2. chunk 加载完成后调用 `parentImport(realModuleId)`；
3. 返回 real module namespace。

因此 Turbopack dynamic import 的链路是：

```text
entry module
  -> context.A(async loader module id)
    -> context.r(loader id)
    -> loader(parentImport)
      -> context.l(lazy chunk)
      -> parentImport(real module id)
```

---

## 13. async module / top-level await：`a`

`tla.js` 源码：

```js
const awaited = await Promise.resolve(`tla-${current}`);
export default awaited;
export const upper = awaited.toUpperCase();
```

产物：

```js
return __turbopack_context__.a(async (handleAsyncDependencies, asyncResult) => {
  try {
    const awaited = await Promise.resolve(...);
    __turbopack_context__.s([...]);
    asyncResult();
  } catch(e) {
    asyncResult(e);
  }
}, true);
```

`a(body, hasAwait)` 的作用：

- 把当前模块的 `exports` / `namespaceObject` 包装成 Promise；
- 用队列追踪异步依赖；
- 处理 top-level await 的 resolve/reject；
- 保留 ESM namespace 的导出语义。

---

## 14. external module：`x`

源码：

```js
import path from "node:path";
```

产物：

```js
var pathExternal = __turbopack_context__.x(
  "node:path",
  () => require("node:path"),
  true
);
```

`x(id, thunk, esm?)` 即 `externalRequire`：

- 调用 `thunk()` 让 Node 原生 `require("node:path")` 加载外部模块；
- 如果 `esm` 为 true 且 raw 不是 ESM，则用 `interopEsm` 包装；
- 加载失败时抛出 `Failed to load external module ...`。

---

## 15. `import.meta.url`：`F`

`meta.js` 源码：

```js
export const metaUrl = import.meta.url;
export const metaProtocol = new URL(metaUrl).protocol;
```

产物：

```js
var __TURBOPACK__import$2e$meta__ = {
  get url() {
    return __turbopack_context__.F("src/meta.js");
  }
};
```

`F(modulePath)` 即 `resolveFileUrl`，会基于 runtime 推导项目路径，再返回 `file://...` URL。

---

## 16. asset bytes

源码：

```js
import payloadBytes from "./fixtures/payload.bin" with { type: "bytes" };
```

Turbopack 生成一个虚拟模块：

```js
"[project]/src/fixtures/payload.bin.[bytes].mjs [client] (ecmascript)"
```

该模块导入 `[turbopack]/shared/base64.ts`，调用：

```js
base64Decode("cGF5bG9hZC1ieXRlcwo")
```

然后通过 `s(["default", () => bytes])` 导出 `Uint8Array`。

---

## 17. CJS `__dirname` / `__filename`

`path-consumer.cjs` 源码使用：

```js
__dirname
__filename
```

Turbopack 产物里变成：

```js
("TURBOPACK compile-time value", "/ROOT/src")
("TURBOPACK compile-time value", "/ROOT/src/path-consumer.cjs")
```

这说明在当前构建配置下，Turbopack 对这些 CJS 路径值做了编译期替换，而不是通过 runtime `P()` 动态求值。

---

## 18. 本 case 未覆盖的 runtime API

`[turbopack]_runtime.js` 是通用 Node runtime，所以包含不少当前 case 没走到的 API：

| API | 作用 | 未覆盖原因 |
|---|---|---|
| `n` | 直接设置完整 namespace | 当前没有需要手工导出 namespace 的模块 |
| `q` / `R` | asset URL 导出与解析 | 本 case 使用 bytes，不使用 asset/resource URL |
| `P` | 解析绝对路径 | `__dirname` 在当前 case 被编译期替换，`import.meta.url` 走 `F` |
| `L` | 通过 URL 加载 chunk | dynamic import 走 chunk path，即 `l` |
| `w` / `u` | wasm instantiate/compile | 未加入 wasm 模块 |
| `b` | Node worker thread | 未加入 worker 场景 |
| `y` | external dynamic `import()` | `node:path` 静态 external 走 `x` |
| `z` | unsupported dynamic require stub | 未加入无法静态分析的动态 require |
| `U` | relative URL fake object | Node target 下当前 URL 场景未触发 |
| `C` | clear chunk cache | 非 HMR/重载场景 |

---

## 19. 总结

这个 complex case 中，Turbopack runtime 的核心路径可以概括为：

```text
R.c(initial chunk)
  -> installCompressedModuleFactories
R.m(entry module)
  -> Context(module, exports)
  -> entry factory
    -> i/r/s for module graph
    -> f for require.context
    -> j for dynamic export * from CJS
    -> x for Node external
    -> A -> v(loader) -> l(chunk) for dynamic import
    -> a for top-level await module
```

相比 basic case 只用到 `R.c`、`R.m`、`i`、`s`，complex case 更完整地展示了 Turbopack Node runtime 如何处理 ESM/CJS 互操作、上下文模块、动态分包、top-level await、外部模块和二进制资源。
