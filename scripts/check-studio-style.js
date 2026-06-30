const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const stylePath = path.join(root, "apps", "studio", "styles.css");
const css = fs.readFileSync(stylePath, "utf8");

const requiredTokens = {
  "--font-brand": "24px",
  "--font-top": "16px",
  "--font-title": "14px",
  "--font-body": "12px",
  "--font-desc": "10px"
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
  if (size > 24) {
    issues.push(`font-size exceeds brand scale: ${match[0]}`);
  }
}

if (issues.length) {
  console.error(issues.map((issue) => `FAIL ${issue}`).join("\n"));
  process.exit(1);
}

console.log("OK studio font scale follows 24/16/14/12/10px rule");
