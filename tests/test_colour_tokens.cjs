// Drift test for the single colour-token source (source/colour-tokens.json).
// 1) every generated block matches the token file, 2) no status colour is defined outside a block,
// 3) literal fallbacks in var(--x-ok, R G B) use the token value, in the comma or space format of that namespace.
const fs = require("fs"), cp = require("child_process"), assert = require("assert");
const front = "custom_components/deepal_companion/frontend";
const tokens = JSON.parse(fs.readFileSync("source/colour-tokens.json", "utf8"));
const names = ["ok", "warn", "bad", "info"];
for (const n of names) assert(Array.isArray(tokens[n]) && tokens[n].length === 3 && tokens[n].every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `token ${n} must be [R,G,B]`);

// 1) generated blocks are current
cp.execFileSync(process.execPath, ["scripts/build-tokens.cjs", "--check"], { stdio: "inherit" });

// Files that may hold style text: sources and directly edited frontend files (generated bundles are covered by the build).
const generated = new Set(["companion-card.js", "cost-design.js", "notification-design.js"]);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + "/" + e.name) : [d + "/" + e.name]));
const files = [...walk("source"), ...fs.readdirSync(front).map((f) => front + "/" + f)]
  .filter((f) => /\.(js|css|html)$/.test(f) && !generated.has(f.split("/").pop()) && !f.includes("/energy/") && !f.includes("/lang/"));
const BLOCK = /\/\*tokens:begin\*\/[\s\S]*?\/\*tokens:end\*\//g;
// A definition has a literal value; an alias such as --design-bad: var(--ds-bad-sp) only points at the token.
const DECL = /--(ds|cost|design)-(ok|warn|bad|info|ac)(-sp)?\s*:(?!\s*var\()/;
const FALLBACK = /var\(\s*--(ds|cost|design)-(ok|warn|bad|info|ac)(-sp)?\s*,\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)\s*\)/g;
const problems = [];
let blocks = 0, fallbacks = 0;
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  blocks += (text.match(BLOCK) || []).length;
  const outside = text.replace(BLOCK, "");
  // 2) no definition outside a generated block
  if (DECL.test(outside)) problems.push(`${f}: status colour defined outside a tokens block`);
  // 3) literal fallbacks equal the token value
  for (const m of outside.matchAll(FALLBACK)) {
    fallbacks++;
    const want = m[2] === "ac" ? tokens.accents[0].dark : tokens[m[2]], got = [m[4], m[5], m[6]].map(Number);
    if (want.join() !== got.join()) problems.push(`${f}: fallback for --${m[1]}-${m[2]} is ${got.join(" ")}, token is ${want.join(" ")}`);
  }
}
assert.strictEqual(blocks, 4, `expected 4 generated blocks, found ${blocks}`);
assert.deepStrictEqual(problems, [], "\n" + problems.join("\n"));
console.log(`Colour token drift test passed (${blocks} blocks, ${fallbacks} fallbacks checked).`);
