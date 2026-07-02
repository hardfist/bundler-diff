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

## Lazy Compilation

`lazy-compilation/` compares persistent cache restore when a dynamic import is
compiled lazily. webpack and Rspack run watch-mode lazy compilation and trigger
the lazy backend twice across cold and warm sessions. Turbopack is reported as a
CLI capability contrast because the top-level Turbopack CLI used by these cases
only exposes persistent-cache `build`.

```sh
pnpm --filter lazy-compilation-cache-case run test:lazy-cache
```
