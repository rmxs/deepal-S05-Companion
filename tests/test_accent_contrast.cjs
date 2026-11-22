// Readability of every theme colour, straight from source/colour-tokens.json (no browser).
// Text on a solid accent needs 4.5:1 in both themes; the accent as an icon or bar on the card surface needs 3:1.
// Green on a light card keeps its original shade (lightLegacy) and is exempt from the surface rule.
const fs = require("fs"), assert = require("assert");
const { accents } = JSON.parse(fs.readFileSync("source/colour-tokens.json", "utf8"));
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const DARK_CARD = [35, 37, 40], LIGHT_CARD = [255, 255, 255], problems = [], ids = new Set();
for (const a of accents) {
  assert(!ids.has(a.id), "duplicate accent id " + a.id); ids.add(a.id);
  for (const k of ["dark", "light", "ink", "inkLight"]) assert(Array.isArray(a[k]) && a[k].length === 3 && a[k].every((v) => Number.isInteger(v) && v >= 0 && v <= 255), a.id + "." + k + " must be [R,G,B]");
  const checks = [["text on accent (dark theme)", ratio(a.ink, a.dark), 4.5], ["text on accent (light theme)", ratio(a.inkLight, a.light), 4.5], ["accent on dark card", ratio(a.dark, DARK_CARD), 3]];
  if (!a.lightLegacy) checks.push(["accent on light card", ratio(a.light, LIGHT_CARD), 3]);
  for (const [what, got, want] of checks) if (got < want) problems.push(a.id + ": " + what + " is " + got.toFixed(2) + ":1, needs " + want + ":1");
}
assert.strictEqual(accents[0].id, "green", "the first accent is the default and must be green");
assert.deepStrictEqual(problems, [], "\n" + problems.join("\n"));
console.log("Accent contrast test passed (" + accents.length + " colours).");
