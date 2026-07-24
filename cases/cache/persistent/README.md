# Persistent Cache Case

This case exercises filesystem-backed persistent cache behavior across
Turbopack, webpack, and Rspack.

The Turbopack build command passes `--persistent-caching`, sets
`TURBO_ENGINE_IGNORE_DIRTY=1` so the example still works in a dirty development
checkout, and stores the cache under `.turbopack/persistent-cache`. The webpack
config uses `cache.type: "filesystem"` and writes to `.webpack-cache`. The
Rspack config uses `cache.type: "persistent"` and writes to `.rspack-cache`.

The verification script removes previous output, runs two builds for each
bundler against the same bundler-specific cache directory, checks that cache
files were created, and executes each generated Node entry.

```sh
pnpm run test:persistent-cache
```

## Multi Compiler Subcase

`multi-compiler/` runs two named child compilers through the webpack and Rspack
JavaScript APIs. A cacheable counting loader records every actual module build,
so the test can distinguish persistent cache reuse from stats-only reporting.
Both bundlers run cold and warm sessions, and the warm session must emit both
entries without invoking the loader again.

The subcase captures three observable differences:

- webpack adds `__compiler1__` and `__compiler2__` to the child compilers'
  default filesystem cache names, producing separate cache locations.
- Rspack keeps the same configured `storage.directory` on both child compilers
  and creates opaque, configuration-hash namespaces inside that directory.
- webpack reports cached module containers in warm multi-compiler stats, while
  Rspack reports the restored modules as `built: false` without setting
  `cached: true`.

```sh
pnpm run test:multi-compiler-cache
```
