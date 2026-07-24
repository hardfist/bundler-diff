# Cases

Cases are small fixtures for comparing behavior across bundlers.

## Cache

`cache/` contains cases for comparing cache behavior across bundlers.

## Runtime

`runtime/` contains executable cases that build the same entry points with
different bundlers. Use these cases to inspect differences in generated runtime
code, loader behavior, asset handling, and observable output.

Each case should keep its source, bundler configuration, generated output, and
verification scripts together so differences are easy to reproduce and compare.

## Performance

`performance/` contains repeatable development-server benchmarks. These cases
measure process memory and end-to-end browser-visible update latency rather than
production bundle output.
