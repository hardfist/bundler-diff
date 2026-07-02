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
