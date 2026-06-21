# Cases

Cases are small fixtures for comparing behavior across bundlers.

## Runtime

`runtime/` contains executable cases that build the same entry points with
different bundlers. Use these cases to inspect differences in generated runtime
code, loader behavior, asset handling, and observable output.

Each case should keep its source, bundler configuration, generated output, and
verification scripts together so differences are easy to reproduce and compare.
