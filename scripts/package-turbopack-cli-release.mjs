import { execFile } from "node:child_process";
import { mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = resolve(root, process.env.TURBOPACK_CLI_RELEASE_DIR ?? ".release");
const packageDir = join(releaseRoot, "turbopack-cli");
const archiveName =
  process.env.TURBOPACK_CLI_RELEASE_ARCHIVE ??
  `turbopack-cli-${platformLabel()}.tar.gz`;
const archivePath = join(releaseRoot, archiveName);

await run("rustup", ["target", "add", "wasm32-unknown-unknown"]);
await run("cargo", ["build", "--release", "--bin", "turbopack-cli"]);
await run("cargo", [
  "build",
  "--release",
  "-p",
  "turbopack-trace-decoder-wasm",
  "--target",
  "wasm32-unknown-unknown",
]);

await rm(packageDir, { recursive: true, force: true });
await mkdir(join(packageDir, "trace-decoder"), { recursive: true });

await copyFile(
  join(root, "target", "release", executableName("turbopack-cli")),
  join(packageDir, executableName("turbopack-cli"))
);
await copyFile(
  join(
    root,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "turbopack_trace_decoder_wasm.wasm"
  ),
  join(packageDir, "trace-decoder", "turbopack_trace_decoder_wasm.wasm")
);
await copyFile(
  join(
    root,
    "crates",
    "turbopack-trace-decoder-wasm",
    "turbopack-trace-decoder.mjs"
  ),
  join(packageDir, "trace-decoder", "turbopack-trace-decoder.mjs")
);
await writeFile(
  join(packageDir, "trace-decoder", "README.md"),
  [
    "# Turbopack Trace Decoder",
    "",
    "This directory is distributed with `turbopack-cli` so raw `.turbopack/trace.log` files can be decoded without a local Next.js checkout.",
    "",
    "```js",
    'import { createTurbopackTraceDecoder } from "./turbopack-trace-decoder.mjs";',
    "",
    "const decoder = await createTurbopackTraceDecoder();",
    "const decoded = decoder.decode(new Uint8Array(await traceFile.arrayBuffer()));",
    "```",
    "",
  ].join("\n")
);
await writeFile(join(packageDir, "source-commit.txt"), `${await sourceCommit()}\n`);

await rm(archivePath, { force: true });
await run("tar", ["-czf", archivePath, "-C", packageDir, "."]);

console.log(archivePath);

async function run(command, args) {
  console.log(`$ ${[command, ...args].join(" ")}`);
  await execFileAsync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      CARGO_TERM_COLOR: process.env.CARGO_TERM_COLOR ?? "always",
    },
    maxBuffer: 1024 * 1024 * 20,
  });
}

async function sourceCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
    });
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

function executableName(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function platformLabel() {
  const platform =
    {
      darwin: "darwin",
      linux: "linux",
      win32: "windows",
    }[process.platform] ?? process.platform;
  return `${platform}-${process.arch}`;
}
