# Lazy Compilation + Persistent Cache Case

This case compares what can be restored when persistent cache and lazy
compilation are used together.

webpack and Rspack both run in watch mode with filesystem-backed persistent
cache enabled. The verification script waits for the initial lazy proxy build,
extracts the lazy module activation key from the generated output, triggers the
lazy backend, waits for the activated compilation, then repeats the same flow
with only `dist/` removed so the second session restores from the existing
cache. For webpack and Rspack, the summary reports module build cache hit rate
as `hits / total` from modules marked `cached` in both the initial lazy proxy
compilation and the activated lazy module compilation, then prints the cached
module names for the cold and warm sessions. The activated compilation can show
cached modules in the cold session because it reuses modules from the initial
compilation in the same watch process.

Turbopack is included as the current CLI contrast. The top-level
`crates/turbopack-cli` used by the existing cases exposes `build` but not `dev`
or a lazy compilation flag, so the script verifies persistent cache restore for
the same dynamic-import entry and reports that this case cannot enable the
lazy dev-server path through that CLI. Its nearest module-build metric is the
`--full-stats` TurboTasks cache hit rate for the `ModuleAssetContext::process`
task from the persistent build run.

```sh
pnpm run test:lazy-cache
```

Cache/output locations:

- webpack: `.webpack-cache`, `dist/webpack`
- Rspack: `.rspack-cache`, `dist/rspack`
- Turbopack: `.turbopack/persistent-cache`, `dist`
