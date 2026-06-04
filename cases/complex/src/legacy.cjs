const secret = "legacy";

module.exports = {
  kind: "commonjs",
  named: `named-${secret}`,
  default: { from: "legacy-default-property" },
  extra: "legacy-extra",
  describe(prefix) {
    return `${prefix}:${this.kind}:${this.named}`;
  },
};
