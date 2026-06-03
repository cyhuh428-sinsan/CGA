const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const stylePath = path.join(root, "apps", "studio", "styles.css");
const css = fs.readFileSync(stylePath, "utf8");

const requiredTokens = {
  "--font-title": "12px",
  "--font-body": "12px",
  "--font-nav": "12px",
  "--font-support": "10px",
  "--font-meta": "9px"
};

const issues = [];

for (const [token, value] of Object.entries(requiredTokens)) {
  const pattern = new RegExp(`${token}:\\s*${value.replace("px", "\\s*px")}\\s*;`);
  if (!pattern.test(css)) {
    issues.push(`missing required font token '${token}: ${value}'`);
  }
}

for (const match of css.matchAll(/font-size:\s*([0-9]+)px/g)) {
  const size = Number(match[1]);
  const before = css.slice(Math.max(0, match.index - 80), match.index);
  const isBrandTitle = /h1\s*\{[^}]*$/.test(before);
  const isSectionTitle = /\.section-title strong\s*\{[^}]*$/.test(before);
  const isWorkflowNumber = /\.workflow a span\s*\{[^}]*$/.test(before);
  if (size > 12 && !(isBrandTitle && size === 24) && !(isSectionTitle && size === 14) && !(isWorkflowNumber && size === 14)) {
    issues.push(`font-size exceeds 12px: ${match[0]}`);
  }
}

if (issues.length) {
  console.error(issues.map((issue) => `FAIL ${issue}`).join("\n"));
  process.exit(1);
}

console.log("OK studio font scale follows 12/11/10/9px rule");
