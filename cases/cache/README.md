# Cache Cases

This directory contains cases for comparing cache behavior across bundlers.

## Persistent

`persistent/` demonstrates Turbopack's filesystem-backed persistent cache. It
builds the same entry twice with `--persistent-caching`, an explicit
`--cache-dir`, and `TURBO_ENGINE_IGNORE_DIRTY=1`, then verifies that cache files
were written and that the built entry still runs.

```sh
pnpm --filter persistent-cache-case run test:persistent-cache
```
