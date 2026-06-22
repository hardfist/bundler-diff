# Persistent Cache Case

This case exercises Turbopack's filesystem-backed persistent cache.

The build command passes `--persistent-caching`, sets
`TURBO_ENGINE_IGNORE_DIRTY=1` so the example still works in a dirty development
checkout, and stores the cache under `.turbopack/persistent-cache`. The
verification script removes previous output, runs two builds against that same
cache directory, checks that cache files were created, and executes the
generated Node entry.

```sh
pnpm run test:persistent-cache
```
