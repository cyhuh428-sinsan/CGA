const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const stylePath = path.join(root, "apps", "studio", "styles.css");
const css = fs.readFileSync(stylePath, "utf8");

const requiredTokens = {
  "--font-brand": "24px",
  "--font-top": "14px",
  "--font-title": "12px",
  "--font-body": "10px",
  "--font-desc": "9px"
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
  const isBrandTitle = /h1\s*\{[^}]*$/.test(before) && size === 24;
  const isTopTitle = (
    /\.section-title strong\s*\{[^}]*$/.test(before) ||
    /\.workflow a span\s*\{[^}]*$/.test(before) ||
    /\.eyebrow\s*\{[^}]*$/.test(before) ||
    /\.hero-panel h2\s*\{[^}]*$/.test(before)
  ) && size === 14;
  if (size > 12 && !isBrandTitle && !isTopTitle) {
    issues.push(`font-size exceeds item-title scale: ${match[0]}`);
  }
}

if (issues.length) {
  console.error(issues.map((issue) => `FAIL ${issue}`).join("\n"));
  process.exit(1);
}

console.log("OK studio font scale follows 24/14/12/10/9px rule");
