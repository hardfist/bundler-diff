const REVISION_PATTERN = /export const HMR_REVISION = "[^"]+";/;

function replaceHmrDependencyRevision(source, revision) {
  if (!REVISION_PATTERN.test(source)) {
    throw new Error("failed to locate the HMR dependency revision marker");
  }
  return source.replace(
    REVISION_PATTERN,
    `export const HMR_REVISION = ${JSON.stringify(revision)};`,
  );
}

module.exports = { replaceHmrDependencyRevision };
