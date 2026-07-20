# 100 路由内存与 HMR 基准

这个 case 比较 Turbopack、webpack 和 Rspack 在开发模式下访问大量低共享度路由时的内存增长，以及模块图变大前后的端到端 HMR 延迟。

默认 fixture 包含 100 个客户端路由。每个路由由 1 个页面模块和 30 个叶子模块组成，只有入口和路由表两个模块共享：总计 3,102 个模块，其中 3,100 个（99.94%）只属于单一路由。路由表使用显式动态 `import()`，webpack 和 Rspack 都开启按动态导入懒编译，Turbopack 使用其 dev server 的按请求编译路径。

## 运行

需要 Node.js 22.4+、pnpm、仓库指定的 Rust nightly，以及本机 Chrome/Chromium。找不到浏览器时可通过 `CHROME_PATH` 指定可执行文件。

```sh
pnpm install
pnpm --dir cases/performance/many-pages benchmark
```

第一次运行会以 release 模式编译 `third_party/turbopack` 中锁定提交的上游 `turbopack-cli`，耗时会明显长于后续运行。也可以通过 `--turbopack-binary=/absolute/path` 使用另一个支持 `dev` 子命令的二进制。

仅做链路冒烟测试时使用：

```sh
pnpm --dir cases/performance/many-pages benchmark:quick
```

`benchmark:quick` 只生成 5 个小路由，并使用 debug Turbopack；其数字不能用于 bundler 间性能比较。

常用参数：

```sh
pnpm --dir cases/performance/many-pages benchmark -- \
  --bundlers=turbopack,webpack,rspack \
  --routes=100 \
  --modules-per-route=30 \
  --payload-items=12 \
  --hmr-runs=5 \
  --hmr-warmup=1 \
  --settle-ms=1000
```

完整参数见 `pnpm --dir cases/performance/many-pages benchmark -- --help`。结果会打印到终端，并写入 `results/latest.json`；生成的 fixture 位于 `.generated/`，两者均不提交。

## 测量口径

### 内存

每个 bundler 从无持久缓存的干净 dev-server 进程启动：

1. 浏览器访问并渲染第 1 个路由；等待稳定后，连续 5 次采样 dev server 及其所有子进程的 RSS，取中位数。
2. 同一 Chrome target 依次重新加载入口并访问剩余 99 个路由，然后回到第 1 个路由再等待和采样。每次路由访问使用新文档，因此只有当前路由保持活跃的 HMR 订阅，但 dev server 进程不会重启。两次采样的当前页面均为 route 1，变化量只来自 dev server 曾经编译过的路由历史。
3. 报告 `RSS@1`、`RSS@100`、绝对增长和百分比增长。

Chrome 进程不计入 RSS。采样进程树而不是只看启动器 PID，避免遗漏 bundler 启动的工作进程。RSS 采样目前支持 macOS 和 Linux。

### HMR

HMR 的 1 路由状态和 100 路由状态分别使用新的干净 dev-server 进程，避免先前 HMR 或内存场景污染结果。100 路由状态会在访问完所有路由后回到 route 1；两种状态都修改 route 1 页面模块中的 revision 标记，避免页面身份成为混杂变量。计时从文件写入前开始，直到 Chrome 中该模块重执行并更新 DOM 为止。

默认先做 1 次不计入结果的预热，再记录 5 次，输出 1/100 路由状态的 median、p95，以及 median 差值和百分比。页面启动时生成的 document token 在每次更新后都会校验；token 改变会使基准失败，因此整页刷新不会被误报成 HMR。

## 解读限制

- 这是开发服务器 RSS 和浏览器可见 HMR 延迟，不是生产构建峰值内存、堆内存或纯编译耗时。
- 三者运行时与分配器不同，绝对 RSS 不等于仍可回收的语言堆；同一 bundler 的 `RSS@100 - RSS@1` 通常比跨 bundler 的单个绝对值更稳健。
- 操作系统文件缓存、CPU 调频和后台负载仍会造成噪声。正式结论应重复完整基准，并比较多轮中位数。
- 更改 `--routes` 后，报告中的 “all” 指该参数指定的累计路由数；默认才是 100。
