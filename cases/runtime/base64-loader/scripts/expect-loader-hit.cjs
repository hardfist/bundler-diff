const { spawnSync } = require("node:child_process");

const result = spawnSync(
  "cargo",
  [
    "run",
    "--manifest-path",
    "../../../crates/turbopack-cli/Cargo.toml",
    "--",
    "build",
    "--dir",
    ".",
    "--root",
    ".",
    "--target",
    "node",
    "--no-minify",
    "--no-sourcemap",
    "--webpack-loader-rule",
    "**/*.ts=./hit-loader.cjs",
    "src/entry.js",
  ],
  {
    cwd: `${__dirname}/..`,
    encoding: "utf8",
  }
);

const output = `${result.stdout || ""}${result.stderr || ""}`;
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");

const expected = [
  "[turbopack]/shared/base64.ts",
  'Resource path "shared/base64.ts" needs to be on project filesystem',
];

if (result.status === 0) {
  console.error("Expected the broad loader rule to hit @turbopack/base64 and fail, but build passed.");
  process.exit(1);
}

for (const text of expected) {
  if (!output.includes(text)) {
    console.error(`Expected output to include: ${text}`);
    process.exit(1);
  }
}

console.log("confirmed: broad loader rule matched @turbopack/base64 ([turbopack]/shared/base64.ts)");
