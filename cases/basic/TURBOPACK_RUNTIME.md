# Turbopack Runtime 深入讲解

本文档基于当前 case 生成产物：

- `cases/basic/dist/[turbopack]_runtime.js`
- `cases/basic/dist/entry.entry.js`
- `cases/basic/dist/src_0k61ek0._.js`

这个产物对应的是 **Node.js production runtime**。它本质上是 Turbopack 打包后注入的一套“小型模块系统”，负责：

1. 加载 chunk 文件；
2. 注册模块工厂函数；
3. 实例化模块并维护模块缓存；
4. 实现 ESM / CommonJS 互操作；
5. 支持动态 import、top-level await、WebAssembly、worker、external module、asset URL 等运行时能力。

---

## 1. basic case 的执行入口

`dist/entry.entry.js` 内容如下：

```js
var R = require("./[turbopack]_runtime.js")("entry.entry.js")
R.c("src_0k61ek0._.js")
R.m("[project]/src/entry.js [client] (ecmascript)")
module.exports = R.m("[project]/src/entry.js [client] (ecmascript)").exports
```

这 4 行展示了 Turbopack runtime 的主流程：

1. 加载 runtime：

   ```js
   var R = require("./[turbopack]_runtime.js")("entry.entry.js")
   ```

   `[turbopack]_runtime.js` 导出一个函数，传入当前入口 chunk 的路径 `entry.entry.js`，返回运行时控制对象 `R`。

2. 加载业务 chunk：

   ```js
   R.c("src_0k61ek0._.js")
   ```

   `R.c` 会同步加载 chunk 文件，并把 chunk 里的模块工厂注册到 runtime 的 `moduleFactories` 表中。

3. 实例化入口模块：

   ```js
   R.m("[project]/src/entry.js [client] (ecmascript)")
   ```

   `R.m` 会从缓存取模块；如果还没实例化，就找到对应 factory 并执行。

4. 把入口模块的 exports 作为 Node.js 当前文件的 `module.exports`：

   ```js
   module.exports = R.m("...").exports
   ```

---

## 2. chunk 文件格式

`dist/src_0k61ek0._.js` 的结构是：

```js
module.exports = [
  "[project]/src/message.js [client] (ecmascript)",
  ((__turbopack_context__) => {
    "use strict";

    function formatMessage(name) {
      return `compiled by ${name}`;
    }

    __turbopack_context__.s([
      "formatMessage",
      0,
      formatMessage
    ]);
  }),

  "[project]/src/entry.js [client] (ecmascript)",
  ((__turbopack_context__) => {
    "use strict";

    var message = __turbopack_context__.i(
      "[project]/src/message.js [client] (ecmascript)"
    );

    console.log(message["formatMessage"]("basic case"));
    __turbopack_context__.s([]);
  }),
];
```

chunk 导出的是一个扁平数组：

```ts
[
  moduleId1,
  moduleFactory1,
  moduleId2,
  moduleFactory2,
  ...
]
```

Turbopack 源码里把这种结构称为 `CompressedModuleFactories`。这样做的好处是格式紧凑、遍历快，而且支持多个 module id 共享同一个 factory，用于 scope hoisting / merged module 场景。

---

## 3. runtime 的两个核心表

`[turbopack]_runtime.js` 内部维护两个最核心的数据结构：

```js
const moduleFactories = new Map();
const moduleCache = Object.create(null);
```

| 名称 | 类型 | 作用 |
|---|---|---|
| `moduleFactories` | `Map<ModuleId, Function>` | chunk 加载后，模块 id 到模块工厂函数的映射 |
| `moduleCache` | `Record<ModuleId, Module>` | 模块执行后的缓存，保证一个模块只执行一次 |

模块对象大致形态：

```js
{
  exports: {},
  error: undefined,
  id,
  namespaceObject: undefined,
  parents: [],
  children: []
}
```

字段含义：

| 字段 | 作用 |
|---|---|
| `exports` | CommonJS 风格导出值 |
| `error` | 模块执行失败后保存错误。后续再次 import/require 会继续抛同一个错误 |
| `id` | Turbopack module id |
| `namespaceObject` | ESM namespace object |
| `parents` / `children` | 模块依赖方向信息。当前 production Node runtime 也创建这个形状，便于统一和 HMR 相关代码路径 |

---

## 4. runtime 导出的公共 API：`R`

`[turbopack]_runtime.js` 最后导出：

```js
module.exports = (sourcePath) => ({
  m: (id) => getOrInstantiateRuntimeModule(sourcePath, id),
  c: (chunkData) => loadRuntimeChunk(sourcePath, chunkData)
});
```

因此入口文件里拿到的 `R` 只有两个方法。

### 4.1 `R.c(chunkData)`：加载 runtime chunk

作用：加载一个 chunk，把其中的 module factory 注册到 `moduleFactories`。

Node.js runtime 中主要逻辑：

```js
const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
const chunkModules = require(resolved);
installCompressedModuleFactories(chunkModules, 0, moduleFactories);
loadedChunks.add(chunkPath);
```

特点：

- 只加载 `.js` chunk；CSS 等非 JS chunk 在 Node runtime 中直接忽略；
- 使用 `loadedChunks` 避免重复加载；
- 加载失败时抛出 `ChunkLoadError`；
- 当前 basic case 中：

  ```js
  R.c("src_0k61ek0._.js")
  ```

  会注册两个模块：

  - `[project]/src/message.js [client] (ecmascript)`
  - `[project]/src/entry.js [client] (ecmascript)`

### 4.2 `R.m(moduleId)`：获取或实例化 runtime module

作用：返回模块对象。如果模块未执行过，则执行其 factory。

核心流程：

```js
const module = moduleCache[moduleId]
if (module) return module
return instantiateRuntimeModule(chunkPath, moduleId)
```

首次执行模块时：

```js
const moduleFactory = moduleFactories.get(id)
const module = createModuleWithDirection(id)
const exports = module.exports
moduleCache[id] = module
const context = new Context(module, exports)
moduleFactory(context, module, exports)
module.loaded = true
return module
```

关键点：

- 模块会先放进 `moduleCache` 再执行 factory，用于支持循环依赖；
- factory 报错时，错误会写入 `module.error`；
- 后续再次加载同一模块时，如果发现 `module.error`，会重新抛出这个错误。

---

## 5. `__turbopack_context__` 是什么

每个模块 factory 都会收到一个参数：

```js
(__turbopack_context__) => {
  // compiled module code
}
```

这个对象由 runtime 的 `Context` 构造函数创建：

```js
function Context(module, exports) {
  this.m = module;
  this.e = exports;
}
```

然后 runtime 把大量短名 API 挂到 `Context.prototype` 上。短名是为了减少打包体积，例如：

- `s` 代表 ESM export；
- `i` 代表 ESM import；
- `r` 代表 CommonJS require；
- `l` 代表 load chunk；
- `a` 代表 async module。

---

## 6. `__turbopack_context__` API 总览

| API | 对应函数 / 值 | 分类 | 作用 |
|---|---|---|---|
| `m` | current module | 状态 | 当前模块对象 |
| `e` | original exports | 状态 | 当前模块初始 exports 对象 |
| `c` | `moduleCache` | 状态 | 模块缓存表 |
| `M` | `moduleFactories` | 状态 | 模块工厂表 |
| `s` | `esmExport` | 导出 | 声明 ESM 导出 |
| `j` | `dynamicExport` | 导出 | 动态 re-export 对象属性 |
| `v` | `exportValue` | 导出 | 直接设置 `module.exports = value` |
| `q` | `exportUrl` | 导出 | 导出 URL / asset 值，Node runtime 下等价于 `v` |
| `n` | `exportNamespace` | 导出 | 直接设置完整 namespace object |
| `i` | `esmImport` | 导入 | ESM 方式导入内部模块，返回 namespace object |
| `r` | `commonJsRequire` | 导入 | CommonJS 方式导入内部模块，返回 `module.exports` |
| `t` | `runtimeRequire` | 导入 | 原生 Node `require`，或浏览器降级 stub |
| `z` | `requireStub` | 导入 | ESM 中动态 require 不支持时的报错函数 |
| `f` | `moduleContext` | 导入 | 支持 `require.context` 和动态 require/import 表达式 |
| `A` | `asyncLoader` | 异步 | 调用异步 loader module |
| `a` | `asyncModule` | 异步 | 支持 top-level await / async ESM module |
| `l` | `loadChunkAsync` | chunk | 异步加载 chunk |
| `L` | `loadChunkAsyncByUrl` | chunk | 按 URL 异步加载 chunk |
| `P` | `resolveAbsolutePath` | 路径 | 解析项目内绝对文件系统路径 |
| `F` | `resolveFileUrl` | 路径 | 解析为 `file://` URL |
| `R` | `resolvePathFromModule` | 路径/asset | 从 asset module 的导出值解析 `file://` URL |
| `U` | `relativeURL` | URL | 构造相对 URL 伪对象 |
| `w` | `loadWebAssembly` | Wasm | 加载并实例化 wasm |
| `u` | `loadWebAssemblyModule` | Wasm | 编译 wasm module |
| `b` | `createWorker` | Worker | 创建 Node.js worker thread |
| `x` | `externalRequire` | external | 加载外部 CommonJS/Node 依赖 |
| `y` | `externalImport` | external | 加载外部 ESM 依赖 |
| `g` | `globalThis` | 全局 | 不受局部变量遮蔽的全局对象引用 |
| `C` | `clearChunkCache` | 缓存 | 清空 chunk 加载缓存 |

下面逐个讲解。

---

## 7. 状态类 API

### 7.1 `m`：当前模块对象

```js
this.m = module;
```

`__turbopack_context__.m` 指向当前正在执行的模块对象。

示意：

```js
{
  id: "[project]/src/entry.js [client] (ecmascript)",
  exports: {},
  namespaceObject: undefined,
  error: undefined,
  parents: [],
  children: []
}
```

用途：

- `commonJsRequire` 需要知道“是谁 require 了这个模块”；
- 错误信息中会记录 parent module id；
- async module 会改写 `module.exports` / `module.namespaceObject`。

### 7.2 `e`：原始 exports 对象

```js
this.e = exports;
```

`e` 保存模块刚创建时的 `exports` 对象。

为什么不总是直接读 `module.exports`？

因为 async module 会把 `module.exports` 改写成 Promise。如果不单独保存原始 exports，`esmExport` 等函数就无法继续往原始对象上定义导出属性。

### 7.3 `c`：模块缓存表

```js
nodeContextPrototype.c = moduleCache;
```

用于：

- 查找模块是否已经实例化；
- 支持循环依赖；
- 给 `esmExport(bindings, id?)` 这种“改写指定模块 exports”的场景使用。

### 7.4 `M`：模块工厂表

```js
nodeContextPrototype.M = moduleFactories;
```

用于保存 chunk 里注册的 factory。

一般业务模块不会直接使用 `M`，但 runtime/HMR/dev 场景会用它管理模块工厂。

---

## 8. 导出类 API

### 8.1 `s(bindings, id?)`：声明 ESM exports

对应函数：`esmExport`。

basic case 中：

```js
__turbopack_context__.s([
  "formatMessage",
  0,
  formatMessage
]);
```

含义是：当前模块导出一个名为 `formatMessage` 的 ESM export，值是函数 `formatMessage`。

`bindings` 是紧凑数组，格式是连续的三种情况之一：

#### 情况一：直接导出值

```js
[
  "name",
  0,
  value
]
```

`0` 是 `BindingTag_Value`，表示后面一个元素是直接值。

runtime 会定义：

```js
Object.defineProperty(exports, "name", {
  value,
  enumerable: true,
  writable: false
})
```

#### 情况二：getter，支持 live binding

```js
[
  "count",
  () => count
]
```

runtime 会定义：

```js
Object.defineProperty(exports, "count", {
  get: () => count,
  enumerable: true
})
```

这能模拟 ESM 的 live binding：如果局部变量 `count` 改变，import 方读到的是新值。

#### 情况三：getter + setter

```js
[
  "value",
  () => value,
  (v) => { value = v }
]
```

runtime 会定义 getter 和 setter。

`s` 还会做三件事：

```js
defineProp(exports, "__esModule", { value: true })
defineProp(exports, Symbol.toStringTag, { value: "Module" })
Object.seal(exports)
```

作用：

- 标记这是 ESM；
- 让 `Object.prototype.toString.call(exports)` 更像 ESM Module；
- seal exports，避免后续随意加属性。

### 8.2 `j(object, id?)`：动态导出对象属性

对应函数：`dynamicExport`。

它会创建一个 Proxy 作为 `module.exports` / `module.namespaceObject`：

- 如果访问的属性在当前 exports 上，返回当前 exports 的值；
- 否则去 re-exported objects 中查找；
- `default` 和 `__esModule` 有特殊处理；
- `ownKeys` 会把动态 re-export 的 key 也合并进来。

主要用于这类场景：

```js
export * from "some-module"
```

或者某些 CJS 动态 re-export 模式。

### 8.3 `v(value, id?)`：直接导出值

对应函数：`exportValue`。

作用：

```js
module.exports = value
```

适合 CommonJS 或 asset module 直接导出一个值。

例如：

```js
__turbopack_context__.v("hello")
```

等价于：

```js
module.exports = "hello"
```

### 8.4 `q(urlValue, id?)`：导出 URL 值

对应函数：`exportUrl`。

在这个 Node.js runtime 中：

```js
function exportUrl(urlValue, id) {
  exportValue.call(this, urlValue, id);
}
```

也就是直接调用 `v`。

在不同 runtime，例如 browser runtime，URL/asset 可能需要加 public path、asset prefix 或 chunk suffix；但当前 Node.js runtime 下不额外处理。

### 8.5 `n(namespace, id?)`：导出完整 namespace

对应函数：`exportNamespace`。

作用：

```js
module.exports = module.namespaceObject = namespace
```

适合已经构造好完整 ESM namespace 的场景。

---

## 9. 导入 / require 类 API

### 9.1 `i(id)`：ESM import 内部模块

对应函数：`esmImport`。

basic case 中入口模块使用它：

```js
var message = __turbopack_context__.i(
  "[project]/src/message.js [client] (ecmascript)"
);

console.log(message["formatMessage"]("basic case"));
```

执行流程：

1. 调用 `getOrInstantiateModuleFromParent(id, this.m)`；
2. 如果目标模块未执行，先执行目标模块 factory；
3. 如果目标模块有 `namespaceObject`，直接返回；
4. 否则说明可能是 CommonJS 模块，调用 `interopEsm` 包装成 ESM namespace。

核心代码：

```js
const module = getOrInstantiateModuleFromParent(id, this.m)
if (module.namespaceObject) return module.namespaceObject
const raw = module.exports
return module.namespaceObject = interopEsm(raw, createNS(raw), raw && raw.__esModule)
```

### 9.2 `r(id)`：CommonJS require 内部模块

对应函数：`commonJsRequire`。

作用：

```js
return getOrInstantiateModuleFromParent(id, this.m).exports
```

也就是返回目标模块的 `module.exports`。

适合编译后的 CommonJS 代码：

```js
const mod = __turbopack_context__.r("module-id")
```

### 9.3 `t`：runtime require

对应值：`runtimeRequire`。

定义：

```js
const runtimeRequire =
  typeof require === 'function'
    ? require
    : function require1() {
        throw new Error('Unexpected use of runtime require')
      };
```

作用：

- 在 Node.js 中就是原生 `require`；
- 在没有 `require` 的环境中提供一个 stub；
- 让一些代码里的 `typeof require === "function"` 判断能成立或被编译后正确处理。

注意：`t` 不是 Turbopack 内部模块 require。内部模块应该用 `r` 或 `i`。

### 9.4 `z(id)`：require stub

对应函数：`requireStub`。

```js
function requireStub(_moduleId) {
  throw new Error('dynamic usage of require is not supported');
}
```

作用：当 ESM 里出现无法静态分析的动态 `require` 时，runtime 用这个函数保证运行时报错明确。

例如类似代码：

```js
require(someVariable)
```

如果 Turbopack 无法编译成静态依赖，就可能落到这个 stub。

### 9.5 `f(map)`：module context

对应函数：`moduleContext`。

用于支持：

- `require.context`；
- 动态 require 表达式；
- 动态 import 表达式中可枚举的上下文映射。

它返回一个函数对象，这个函数对象有几个方法：

```js
const ctx = __turbopack_context__.f(map)

ctx("./a.js")          // 加载模块
ctx.keys()             // 返回所有可匹配 key
ctx.resolve("./a.js")  // 返回 module id
ctx.import("./a.js")   // async import
```

内部会先调用 `parseRequest`，去掉 query 和 hash：

```js
"./a.js?foo#bar" -> "./a.js"
```

找不到时抛：

```js
const e = new Error(`Cannot find module '${id}'`)
e.code = 'MODULE_NOT_FOUND'
throw e
```

---

## 10. ESM / CommonJS 互操作

Turbopack runtime 同时要支持 ESM 和 CJS。关键函数是：

```js
interopEsm(raw, ns, allowExportDefault)
```

它的作用是把 CommonJS exports 包装成 ESM namespace。

### 10.1 ESM 导入 CJS

如果 CommonJS 模块是：

```js
module.exports = function foo() {}
```

ESM 中可能这样导入：

```js
import foo from "./cjs"
```

runtime 需要把 raw CJS exports 包装成：

```js
{
  default: raw
}
```

### 10.2 收集 raw 对象属性

`interopEsm` 会沿着 prototype chain 收集属性：

```js
for (
  let current = raw;
  (typeof current === 'object' || typeof current === 'function') &&
    !LEAF_PROTOTYPES.includes(current);
  current = getProto(current)
) {
  for (const key of Object.getOwnPropertyNames(current)) {
    bindings.push(key, createGetter(raw, key));
  }
}
```

但遇到这些叶子原型就停止：

- `null`
- `Object.prototype`
- `Array.prototype`
- `Function.prototype`

这样可以避免把所有普通对象/数组/函数的原型方法都导出去。

### 10.3 default 的处理

如果 `raw` 已有 `default` 属性，runtime 会根据 `allowExportDefault` 判断：

- 如果允许使用 raw.default 作为 default，就保留 getter；
- 否则把 default 改成 raw 本身。

这就是 CJS/ESM 互操作中最容易混淆的部分。

---

## 11. 异步与动态 chunk API

### 11.1 `l(chunkData)`：异步加载 chunk

对应函数：`loadChunkAsync`。

Node runtime 中虽然函数名叫 async，但实际内部仍然通过 `require` 同步读取 chunk，然后返回一个 Promise。

核心逻辑：

```js
const resolved = path.resolve(RUNTIME_ROOT, chunkPath)
const chunkModules = require(resolved)
installCompressedModuleFactories(chunkModules, 0, moduleFactories)
entry = Promise.resolve(undefined)
```

特点：

- 返回 `Promise<void>`；
- 通过 `chunkCache` 缓存结果；
- 如果加载失败，会缓存 rejected Promise；
- 非 JS chunk 返回 resolved Promise，不做事。

典型用于动态 import 分包：

```js
await __turbopack_context__.l("some_chunk.js")
const mod = __turbopack_context__.i("module-in-that-chunk")
```

### 11.2 `L(chunkUrl)`：按 URL 加载 chunk

对应函数：`loadChunkAsyncByUrl`。

逻辑：

```js
const path = url.fileURLToPath(new URL(chunkUrl, RUNTIME_ROOT))
return loadChunkAsync.call(this, path)
```

也就是先把 URL 转成本地文件路径，再走 `l`。

### 11.3 `A(moduleId)`：async loader

对应函数：`asyncLoader`。

```js
function asyncLoader(moduleId) {
  const loader = this.r(moduleId);
  return loader(esmImport.bind(this));
}
```

含义：

1. 用 CommonJS 方式加载一个 loader module；
2. 调用 loader，并把绑定到当前 context 的 `esmImport` 传进去；
3. loader 自己决定如何异步导入真实模块。

常用于编译后的 dynamic import loader。

### 11.4 `a(body, hasAwait)`：async module / top-level await 支持

对应函数：`asyncModule`。

它用于支持包含 top-level await 的 ESM 模块，例如：

```js
const data = await loadData()
export { data }
```

这类模块不能同步得到最终 exports，所以 runtime 会：

1. 创建一个 Promise；
2. 把当前模块的 `exports` 和 `namespaceObject` 都改成这个 Promise；
3. 在 Promise 上挂 Turbopack 私有 symbol：
   - `turbopackExports`
   - `turbopackQueues`
   - `turbopackError`
4. 追踪异步依赖队列；
5. 等依赖 resolve 后，再 resolve 当前模块。

核心思想：

```js
Object.defineProperty(module, 'exports', {
  get() { return promise },
  set(v) {
    if (v !== promise) promise[turbopackExports] = v
  }
})
```

也就是说，对 async module 来说：

- `module.exports` 表面上是 Promise；
- 真正的 exports 存在 Promise 的 symbol 属性里；
- 依赖关系通过 queue 传播 resolve/reject。

---

## 12. 路径、URL、asset API

### 12.1 `P(modulePath?)`：解析绝对路径

对应函数：`resolveAbsolutePath`。

```js
function resolveAbsolutePath(modulePath) {
  if (modulePath) {
    return path.join(ABSOLUTE_ROOT, modulePath);
  }
  return ABSOLUTE_ROOT;
}
```

用于生成：

- `__dirname`
- `__filename`
- 某些 `import.meta` 相关静态值

这些值没有在编译时直接写死，而是由 runtime 根据当前 runtime 文件位置推导。

### 12.2 `F(modulePath?)`：解析 file URL

对应函数：`resolveFileUrl`。

```js
function resolveFileUrl(modulePath) {
  return require('url').pathToFileURL(resolveAbsolutePath(modulePath)).href;
}
```

用于生成：

```js
file:///absolute/path/to/file.js
```

比手动拼 `file://` 更安全，因为它会处理 Windows drive letter、路径转义等问题。

### 12.3 `R(moduleId)`：从 asset module 解析 file URL

对应函数：`resolvePathFromModule`。

逻辑：

1. `this.r(moduleId)` 加载 asset module；
2. 读取导出值：

   ```js
   const exportedPath = exported?.default ?? exported
   ```

3. 如果导出不是字符串，直接返回；
4. 去掉 `ASSET_PREFIX`；
5. 基于 `RUNTIME_ROOT` 解析绝对路径；
6. 转成 `file://` URL。

适合这类资源引用：

```js
new URL("./asset.png", import.meta.url)
```

### 12.4 `U(inputUrl)`：relative URL 伪对象

对应函数：`relativeURL`。

这个函数构造一个“像 URL 的对象”，但保留相对 URL 的字符串形式。

背景：

```js
new URL("./image.png", import.meta.url)
```

在 SSR 和 client 环境中，base URL 可能不同，容易导致 hydration mismatch。`relativeURL` 用一个伪 URL 对象让：

```js
url.toString()
```

仍然返回原始相对路径。

它会设置：

```js
values.href = inputUrl
values.pathname = inputUrl.replace(/[?#].*/, '')
values.origin = values.protocol = ''
values.toString = values.toJSON = () => inputUrl
```

---

## 13. WebAssembly API

### 13.1 `w(chunkPath, edgeModule, imports)`：加载并实例化 wasm

对应函数：`loadWebAssembly`。

Node runtime 中：

```js
const resolved = path.resolve(RUNTIME_ROOT, chunkPath)
return instantiateWebAssemblyFromPath(resolved, imports)
```

内部使用：

```js
WebAssembly.instantiateStreaming(response, importsObj)
```

返回：

```js
instance.exports
```

### 13.2 `u(chunkPath, edgeModule)`：编译 wasm module

对应函数：`loadWebAssemblyModule`。

Node runtime 中：

```js
const resolved = path.resolve(RUNTIME_ROOT, chunkPath)
return compileWebAssemblyFromPath(resolved)
```

内部使用：

```js
WebAssembly.compileStreaming(response)
```

返回 `WebAssembly.Module`。

---

## 14. Worker API

### 14.1 `b(WorkerConstructor, workerPath, workerOptions?)`

对应函数：`createWorker`。

作用：创建 Node.js `worker_threads` 的 Worker，并把一些全局变量转发给 worker。

核心逻辑：

```js
const forwardedGlobals = {}
for (const name of WORKER_FORWARDED_GLOBALS) {
  forwardedGlobals[name] = globalThis[name]
}

const options = {
  ...workerOptions,
  workerData: {
    ...existingWorkerData,
    __turbopack_globals__: forwardedGlobals
  }
}

return new WorkerConstructor(workerPath, options)
```

当前 basic case 中：

```js
var WORKER_FORWARDED_GLOBALS = [];
```

所以没有实际转发任何 global。

---

## 15. external module API

external module 指没有被 Turbopack 打进 bundle，而是在运行时交给宿主环境加载的依赖。

### 15.1 `x(id, thunk, esm?)`：external require

对应函数：`externalRequire`。

典型形态：

```js
__turbopack_context__.x("fs", () => require("fs"))
```

逻辑：

1. 执行 `thunk()`；
2. 如果失败，抛出更清晰的错误：

   ```js
   Failed to load external module ${id}: ${err}
   ```

3. 如果 `esm` 为 false，直接返回 raw；
4. 如果需要 ESM namespace 且 raw 不是 `__esModule`，调用 `interopEsm` 包装。

它还挂了：

```js
externalRequire.resolve = (id, options) => require.resolve(id, options)
```

### 15.2 `y(id)`：external import

对应函数：`externalImport`。

逻辑：

```js
raw = await import(id)
```

如果导入结果是某些 CJS/ESM 混合形态：

```js
if (raw && raw.__esModule && raw.default && 'default' in raw.default) {
  return interopEsm(raw.default, createNS(raw), true);
}
```

否则直接返回 raw。

---

## 16. 全局与缓存 API

### 16.1 `g`：globalThis

```js
contextPrototype.g = globalThis;
```

作用：让编译后的模块可以稳定访问全局对象，即使源码里有局部变量叫 `globalThis` 也不受影响。

### 16.2 `C()`：清理 chunk cache

对应函数：`clearChunkCache`。

```js
function clearChunkCache() {
  chunkCache.clear();
  loadedChunks.clear();
}
```

主要用于 runtime reload / dev / HMR 类场景。当前 production basic case 一般不会用到。

---

## 17. 内部 helper 说明

虽然下面这些函数没有直接暴露给业务模块，但理解它们有助于理解 runtime。

### 17.1 `SourceType`

枚举模块实例化原因：

| 值 | 名称 | 含义 |
|---|---|---|
| `0` | `Runtime` | 作为某个 runtime chunk 的入口模块实例化 |
| `1` | `Parent` | 被父模块 import/require 时实例化 |
| `2` | `Update` | 因 HMR update 实例化 |

用于构造更清晰的错误信息。

### 17.2 `defineProp(obj, name, options)`

只有当对象自己没有这个属性时才定义：

```js
if (!hasOwnProperty.call(obj, name)) {
  Object.defineProperty(obj, name, options)
}
```

用于避免重复定义 `__esModule`、导出属性等。

### 17.3 `getOverwrittenModule(moduleCache, id)`

获取或创建指定 id 的 module object。

主要服务于这些 API 的第二个参数 `id`：

```js
s(bindings, id?)
j(object, id?)
v(value, id?)
n(namespace, id?)
```

如果传了 `id`，表示不是改当前模块，而是改缓存里另一个模块。

### 17.4 `createModuleObject(id)` / `createModuleWithDirection(id)`

创建模块对象。

区别：

- `createModuleObject`：普通模块对象；
- `createModuleWithDirection`：额外包含 `parents` / `children`。

当前 Node build runtime 里：

```js
createModuleWithDirectionFlag = true
```

所以创建的是带方向信息的模块对象。

### 17.5 `installCompressedModuleFactories(chunkModules, offset, moduleFactories, newModuleId?)`

把 chunk 导出的扁平数组注册到 `moduleFactories`。

它支持多个 id 共享同一个 factory，例如：

```js
[
  id1,
  id2,
  factory,
  id3,
  factory2
]
```

注册后：

```js
moduleFactories.set(id1, factory)
moduleFactories.set(id2, factory)
moduleFactories.set(id3, factory2)
```

如果某个 group 中已有 factory，则新 id 会复用已有 group factory，保证 merged module 一致。

### 17.6 `applyModuleFactoryName(factory)`

```js
Object.defineProperty(factory, 'name', {
  value: 'module evaluation'
})
```

作用：给 factory 一个更友好的函数名，改善 stack trace。

### 17.7 `factoryNotAvailableMessage(moduleId, sourceType, sourceData)`

当找不到模块 factory 时，生成更明确的错误信息：

```text
Module ${moduleId} was instantiated because it was required from module ${sourceData}, but the module factory is not available.
```

根据 `SourceType` 区分是 runtime entry、parent import，还是 HMR update。

### 17.8 `isJs(chunkUrlOrPath)`

判断 chunk 是否是 JS：

```js
/\.js(?:\?[^#]*)?(?:#.*)?$/
```

支持：

- `a.js`
- `a.js?query`
- `a.js#hash`
- `a.js?query#hash`

非 JS chunk 在 Node runtime 中不加载。

---

## 18. basic case 的完整执行时序

执行：

```bash
node cases/basic/dist/entry.entry.js
```

时序如下：

```text
entry.entry.js
  |
  |-- require("./[turbopack]_runtime.js")("entry.entry.js")
  |     |
  |     `-- 返回 R = { c, m }
  |
  |-- R.c("src_0k61ek0._.js")
  |     |
  |     |-- require("/absolute/path/src_0k61ek0._.js")
  |     |-- 得到 compressed module factories 数组
  |     |-- 注册 message.js factory 到 moduleFactories
  |     `-- 注册 entry.js factory 到 moduleFactories
  |
  |-- R.m("[project]/src/entry.js [client] (ecmascript)")
  |     |
  |     |-- moduleCache 中没有 entry.js
  |     |-- 创建 entry module
  |     |-- 创建 __turbopack_context__
  |     |-- 执行 entry.js factory
  |     |     |
  |     |     |-- __turbopack_context__.i("message.js")
  |     |     |     |
  |     |     |     |-- moduleCache 中没有 message.js
  |     |     |     |-- 创建 message module
  |     |     |     |-- 执行 message.js factory
  |     |     |     |     |
  |     |     |     |     `-- __turbopack_context__.s([
  |     |     |     |           "formatMessage", 0, formatMessage
  |     |     |     |         ])
  |     |     |     |
  |     |     |     `-- 返回 message namespaceObject
  |     |     |
  |     |     |-- console.log(message.formatMessage("basic case"))
  |     |     |
  |     |     `-- __turbopack_context__.s([])
  |     |
  |     `-- 返回 entry module
  |
  `-- module.exports = entry module exports
```

最终输出：

```text
compiled by basic case
```

---

## 19. 一句话总结

Turbopack runtime 可以理解为：

> chunk 文件只提供模块工厂；runtime 负责加载 chunk、注册 factory、创建 module、执行 factory、缓存 exports，并补齐 ESM/CJS/async/wasm/asset/external 等 JavaScript 模块系统所需的运行时语义。

在这个 basic case 中，真正走到的 API 很少：

| API | 用途 |
|---|---|
| `R.c` | 加载 `src_0k61ek0._.js` chunk |
| `R.m` | 实例化入口模块 |
| `__turbopack_context__.i` | entry 模块导入 message 模块 |
| `__turbopack_context__.s` | message 和 entry 声明 ESM exports |

但 `[turbopack]_runtime.js` 同时包含了更多通用能力，以支持更复杂的真实项目。
