module.exports = function hitLoader(source) {
  const resource = this.resourcePath || this.resource || "unknown-resource";
  return `${source}\nconsole.log(${JSON.stringify(`loader-hit:${resource}`)});\n`;
};
