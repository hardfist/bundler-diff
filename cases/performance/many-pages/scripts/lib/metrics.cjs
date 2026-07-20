const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function percentile(sorted, fraction) {
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function summarizeSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("samples must be a non-empty array");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    count: sorted.length,
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1),
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

function parsePsTable(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)(?:\s+(.*))?$/))
    .filter(Boolean)
    .map((match) => ({
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      rssKb: Number(match[3]),
      command: match[4] || "",
    }));
}

function descendantsOf(processes, rootPid) {
  const byParent = new Map();
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  for (const process of processes) {
    const children = byParent.get(process.parentPid) || [];
    children.push(process);
    byParent.set(process.parentPid, children);
  }

  const result = [];
  const pending = [rootPid];
  while (pending.length > 0) {
    const pid = pending.shift();
    const process = byPid.get(pid);
    if (!process) continue;
    result.push(process);
    for (const child of byParent.get(pid) || []) {
      pending.push(child.pid);
    }
  }
  return result;
}

async function readProcessTreeRss(rootPid) {
  if (process.platform === "win32") {
    throw new Error("process-tree RSS sampling currently supports macOS and Linux only");
  }
  const { stdout } = await execFileAsync("ps", [
    "-axo",
    "pid=,ppid=,rss=,command=",
  ]);
  const processes = descendantsOf(parsePsTable(stdout), rootPid);
  if (processes.length === 0) {
    throw new Error(`server process ${rootPid} was not present in the process table`);
  }
  return {
    rssKb: processes.reduce((sum, item) => sum + item.rssKb, 0),
    processes,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sampleProcessTreeRss(rootPid, options = {}) {
  const { count = 5, intervalMs = 100 } = options;
  const samplesKb = [];
  let lastProcesses = [];
  for (let index = 0; index < count; index += 1) {
    const sample = await readProcessTreeRss(rootPid);
    samplesKb.push(sample.rssKb);
    lastProcesses = sample.processes;
    if (index + 1 < count) await delay(intervalMs);
  }
  return {
    samplesKb,
    summaryKb: summarizeSamples(samplesKb),
    processes: lastProcesses,
  };
}

module.exports = {
  delay,
  descendantsOf,
  parsePsTable,
  readProcessTreeRss,
  sampleProcessTreeRss,
  summarizeSamples,
};
