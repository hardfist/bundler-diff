# 10 个超大路由的内存与 HMR 基准

这个 case 比较 Turbopack、webpack 和 Rspack 在开发模式下访问大量低共享度路由时的 macOS Physical footprint 增长，以及模块图变大前后的端到端 HMR 延迟。

默认 fixture 包含 10 个客户端路由。每个路由由 1 个页面模块和 9,000 个叶子模块组成，只有入口和路由表两个模块共享：总计 90,012 个模块，其中 90,010 个（99.9978%）只属于单一路由。路由表使用显式动态 `import()`，webpack 和 Rspack 都开启按动态导入懒编译，Turbopack 使用其 dev server 的按请求编译路径。

## 运行

需要 macOS、Node.js 22.4+、pnpm、仓库指定的 Rust nightly，以及本机 Chrome/Chromium。内存采样使用系统自带的 `/usr/bin/footprint`；找不到浏览器时可通过 `CHROME_PATH` 指定可执行文件。

```sh
pnpm install
pnpm --dir cases/performance/many-pages benchmark
```

第一次运行会以 release 模式编译 `crates/turbopack-cli` 中的本地 wrapper；它使用 `third_party/turbopack` 中锁定的上游实现，并额外暴露 benchmark 所需的 dev persistent-cache 和 memory-eviction 开关。首次编译耗时会明显长于后续运行。也可以通过 `--turbopack-binary=/absolute/path` 使用另一个兼容这些参数的二进制。

仅做链路冒烟测试时使用：

```sh
pnpm --dir cases/performance/many-pages benchmark:quick
```

`benchmark:quick` 只生成 5 个小路由，并使用 debug Turbopack；其数字不能用于 bundler 间性能比较。

常用参数：

```sh
pnpm --dir cases/performance/many-pages benchmark -- \
  --bundlers=turbopack,webpack,rspack \
  --routes=10 \
  --modules-per-route=9000 \
  --payload-items=12 \
  --hmr-runs=5 \
  --hmr-warmup=1 \
  --settle-ms=1000
```

完整参数见 `pnpm --dir cases/performance/many-pages benchmark -- --help`。结果会打印到终端，并写入 `results/latest.json`；生成的 fixture 位于 `.generated/`，两者均不提交。

### Turbopack memory eviction

默认的三 bundler 对比仍关闭 Turbopack persistent cache。要隔离测试 `memory_eviction`，需要让 off/full 两轮都启用 persistent cache，只改变 eviction 模式：

```sh
pnpm --dir cases/performance/many-pages benchmark -- \
  --bundlers=turbopack \
  --skip-hmr \
  --turbopack-persistent-cache=on \
  --turbopack-memory-eviction=off \
  --turbopack-snapshot-idle-ms=10000 \
  --turbopack-snapshot-timeout-ms=300000

pnpm --dir cases/performance/many-pages benchmark -- \
  --bundlers=turbopack \
  --skip-hmr \
  --turbopack-persistent-cache=on \
  --turbopack-memory-eviction=full \
  --turbopack-snapshot-idle-ms=10000 \
  --turbopack-snapshot-timeout-ms=300000
```

每个 dev server 使用全新的临时 cache 目录，退出后自动删除。`turbopack-snapshot-idle-ms` 控制空闲多久后开始 snapshot，默认 10 秒以覆盖连续路由访问之间的短暂空闲；如果 route 2–10 尚未访问完就出现 marker，benchmark 会直接失败并要求增大该值。本地 CLI 在完整 background-snapshot span 关闭后写 completion marker；benchmark 只会在测量侧保持 idle 且没有出现 persistence、compaction 或 marker 写入错误时接受它。benchmark 先消费入口图的初始 marker，再为每个待测路由状态等待一个由该状态触发的新 marker，之后才会采样。`turbopack-snapshot-timeout-ms` 只控制等待这个明确信号的超时时间。

在 2026-07-24 的同机 10×9000 release 测试中：

| Persistent cache | Memory eviction | Footprint@1 | Footprint@10 | 路由增长 |
| --- | --- | ---: | ---: | ---: |
| on | off | 5677.7 MiB | 5947.8 MiB | +270.0 MiB |
| on | full | 1030.8 MiB | 1351.1 MiB | +320.3 MiB |

相同 persistent-cache 条件下，full eviction 分别降低 `Footprint@1` 4647.0 MiB（81.8%）和 `Footprint@10` 4596.7 MiB（77.3%）。full 模式的多路由增量略高，但它从显著更低的 snapshot 后基线开始。

## 测量口径

### 内存

默认对比中，每个 bundler 从无持久缓存的干净 dev-server 进程启动：

两者都启用单代内存 cache：webpack 显式配置 `cache.type = "memory"` 和 `maxGenerations = 1`，Rspack 使用 `cache: true` 对应的开发模式 memory cache（内部 `max_generations = 1`）。cache 只存在于本次 dev-server 进程，不写入持久缓存目录。

1. 浏览器访问并渲染第 1 个路由；等待稳定后，连续 5 次运行 `/usr/bin/footprint -f bytes -t <server-pid>`，取 Physical footprint 中位数。
2. 同一 Chrome target 依次重新加载入口并访问剩余 9 个路由，然后回到第 1 个路由再等待和采样。每次路由访问使用新文档，因此只有当前路由保持活跃的 HMR 订阅，但 dev server 进程不会重启。两次采样的当前页面均为 route 1，变化量只来自 dev server 曾经编译过的路由历史。
3. 报告 `Footprint@1`、`Footprint@10`、绝对增长和百分比增长。

webpack 5 的默认 lazy-compilation backend 会在客户端断开后继续保留模块 120 秒，而且这个延迟没有公开配置项。该窗口会让快速访问过的所有路由同时留在最终 compilation，无法与 Rspack 每次 compilation 消费并清空 active set 的行为对齐。因此本 case 为 webpack 使用等价的自定义 backend，将断开后的 deactivation delay 设为 `0`；这只改变 lazy module 的失活时机，不改变路由、模块量或缓存配置。

`footprint -t` 会包含 dev server 的所有后代进程，并对进程间共享映射去重；多进程场景读取其 `Summary Footprint`，而不是把各进程指标简单相加。Chrome 不属于 dev-server 进程树，因此不计入结果。Physical footprint 采样仅支持 macOS。

启用 Turbopack persistent cache 时，每个采样点都会等待 CLI 的 snapshot completion marker。memory eviction 只在 snapshot 持久化完成后执行，不是基于 RSS 或内存压力触发的通用 GC。

### HMR

HMR 的 1 路由状态和 10 路由状态分别使用新的干净 dev-server 进程，避免先前 HMR 或内存场景污染结果。10 路由状态会在访问完所有路由后回到 route 1；两种状态都修改 route 1 的叶子依赖 `module-001.js` 中导出的 revision，避免页面身份成为混杂变量。页面模块显式接受并消费这个依赖；Rspack 配置关闭 incremental `buildChunkGraph` 跳过，保证 dependency rebuild 后完整执行该阶段及其后续处理。计时从依赖文件写入前开始，直到 dependency accept 回调使用新的 ESM binding 更新 Chrome DOM 为止。

默认先做 1 次不计入结果的预热，再记录 5 次，输出 1/10 路由状态的 median、p95，以及 median 差值和百分比。页面启动时生成的 document token 在每次更新后都会校验；token 改变会使基准失败，因此整页刷新不会被误报成 HMR。

## 解读限制

- 这是开发服务器 Physical footprint 和浏览器可见 HMR 延迟，不是生产构建峰值内存、语言堆大小或纯编译耗时。
- 三者运行时与分配器不同，绝对 Physical footprint 不等于仍可回收的语言堆；同一 bundler 的 `Footprint@10 - Footprint@1` 通常比跨 bundler 的单个绝对值更稳健。
- 操作系统文件缓存、CPU 调频和后台负载仍会造成噪声。正式结论应重复完整基准，并比较多轮中位数。
- 更改 `--routes` 后，报告中的 “all” 指该参数指定的累计路由数；默认才是 10。
