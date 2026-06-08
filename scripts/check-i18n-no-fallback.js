const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const localeDir = path.join(root, "packages", "i18n", "locales");
const english = JSON.parse(fs.readFileSync(path.join(localeDir, "en.json"), "utf8"));
const targetLocales = ["de.json", "fr.json", "ja.json", "vi.json", "zh-CN.json"];
const failures = [];

for (const file of targetLocales) {
  const data = JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
  for (const [key, englishValue] of Object.entries(english)) {
    if (data[key] === englishValue) {
      failures.push(`${file} still matches English for '${key}'`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OK primary non-English locale files have no English fallback values");
