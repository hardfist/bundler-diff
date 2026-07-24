# Persistent Cache + Multi Compiler Case

This subcase compares webpack and Rspack when two named child compilers share a
persistent cache root.

Each compiler builds its own entry plus a shared module. A cacheable loader
appends one trace record per real module build. The comparison script starts a
fresh multi compiler for a cold session, closes it to flush the persistent
cache, removes only the output, and starts another fresh multi compiler for the
warm session. The loader trace must remain at four records after the warm
session, proving that both child compilers restored their two modules.

The result also shows the bundlers' different namespace and stats behavior:

- webpack normalizes the two default cache names to
  `client-development__compiler1__` and
  `server-development__compiler2__`.
- Rspack leaves both child compilers pointed at `.rspack-cache` and stores them
  in separate configuration-hash directories.
- webpack's warm stats expose cached module containers; Rspack's expose the
  restored modules as not built but do not mark them as cached.

Run it from the parent persistent-cache package:

```sh
pnpm run test:multi-compiler-cache
```
