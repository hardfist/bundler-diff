# Persistent Cache + Multi Compiler Case

webpack and Rspack each build the same entry with two named child compilers.
The script runs cold and warm builds, executes both outputs, and compares their
cache directories: webpack creates named `__compilerN__` directories, while
Rspack creates configuration-hash directories in one shared storage root.

```sh
pnpm run test:multi-compiler-cache
```
