# Local Turbopack CLI wrapper

This crate keeps the existing runtime/build extensions and adds the dev-server controls needed by
the benchmarks in this repository.

The upstream CLI is a Git submodule, so changes inside it cannot be committed to this repository.
The following files are therefore synchronized from
`third_party/turbopack/turbopack/crates/turbopack-cli`:

- `src/dev/mod.rs`
- `src/dev/web_entry_source.rs`
- `src/embed_js.rs`
- `js/`

Intentional local differences are limited to the local context API, the
`--turbopack-memory-eviction` backend option, and the benchmark-only snapshot completion marker.
When the submodule is updated, review these copies against upstream before rebuilding the wrapper.
