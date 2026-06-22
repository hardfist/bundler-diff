# Cache Cases

This directory contains cases for comparing cache behavior across bundlers.

## Persistent

`persistent/` demonstrates filesystem-backed persistent cache behavior across
Turbopack, webpack, and Rspack. It builds the same entry twice for each bundler,
then verifies that cache files were written and that each built entry still
runs.

```sh
pnpm --filter persistent-cache-case run test:persistent-cache
```
