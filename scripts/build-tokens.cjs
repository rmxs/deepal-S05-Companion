// Writes the status colours from source/colour-tokens.json into the marked block of each style site.
// `node scripts/build-tokens.cjs --check` changes nothing and exits 1 when a block differs.
const fs = require("fs");
const front = "custom_components/deepal_companion/frontend/";
const tokens = JSON.parse(fs.readFileSync("source/colour-tokens.json", "utf8"));
const names = ["ok", "warn", "bad", "info"];
const comma = (n) => tokens[n].join(",");
const space = (n) => tokens[n].join(" ");
// The default accent (the first entry, green) is the card's default theme colour.
const A0 = tokens.accents[0];
const accentDefaults = () => [`--ds-ac: ${A0.dark.join(",")};`, `--ds-ac-sp: ${A0.dark.join(" ")};`, `--ds-ac-ink: ${A0.ink.join(",")};`, "--ds-ac-rot: 0deg;", "--ds-ac-sat: 1;"];
const accentsJs = () => "const ACCENTS = [\n" + tokens.accents.map((a) => "  " + JSON.stringify([a.id, a.label, a.dark.join(","), a.light.join(","), a.ink.join(","), a.inkLight.join(","), a.hue].concat(a.sat === undefined ? [] : [a.sat])).replaceAll('","', '", "').replace("[\"", '["') + ",").join("\n") + "\n];";
// Shared interface tokens (--cp-*): the same definition in the card and in the panel, so one element looks the same on every page.
const cpTokens = () => { const ac = `var(--ds-ac,var(--ds-ok,${comma("ok")}))`; return `--cp-accent:rgb(${ac});--cp-on-bg:rgba(${ac},.12);--cp-on-line:rgba(${ac},.45);--cp-off-bg:rgba(var(--rgb-primary-text-color,255,255,255),.04);--cp-off-line:var(--divider-color,rgba(127,127,127,.25));--cp-track:color-mix(in srgb,var(--primary-text-color,#fff) 22%,transparent);--cp-figure:var(--primary-text-color);--cp-ink:rgb(var(--ds-ac-ink,16,21,18));--cp-press:.965;--cp-spring:cubic-bezier(.2,.9,.3,1.25);--cp-sw-w:44px;--cp-sw-h:24px;--cp-sw-k:20px;--cp-block-r:20px;--cp-block-p:16px;--cp-block-bg:var(--ha-card-background,var(--card-background-color,#1c1c1e));--cp-item-r:14px;--cp-item-p:12px;--cp-ctl-h:44px;--cp-ctl-r:12px;--cp-x:32px;--cp-sheet-r:26px;--cp-sheet-p:16px;`; };
const SITES = [
  // Card: comma form for rgba(var(--ds-x), a) and space form for rgb(var(--design-x) / a).
  { file: "source/card.js", render: () => names.map((n) => `--ds-${n}: ${comma(n)};`).concat(names.map((n) => `--ds-${n}-sp: ${space(n)};`)).concat(accentDefaults()).join(" ") },
  { file: front + "companion-panel.css", render: () => names.map((n) => `--ds-${n}:${comma(n)};`).join("") },
  { file: front + "companion-cost-design.js", render: () => names.map((n) => `--cost-${n}:${space(n)};`).join("") },
  { file: front + "companion-notifications-design.js", render: () => names.map((n) => `--design-${n}:${space(n)};`).join("") },
];
// Shared interface rules (press, switches, selected states, blocks): source/companion-shared.css, copied into every style root.
const sharedCss = () => fs.readFileSync("source/companion-shared.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
const UI_BLOCK = /\/\*ui:begin\*\/[\s\S]*?\/\*ui:end\*\//g;
const UI_SITES = [
  { file: "source/card.js", js: true },
  { file: front + "companion-notifications-design.js", js: true },
  { file: front + "companion-panel.css", js: false },
];
const CP_BLOCK = /\/\*cp:begin\*\/[\s\S]*?\/\*cp:end\*\//g;
const BLOCK = /\/\*tokens:begin\*\/[\s\S]*?\/\*tokens:end\*\//g;
const ACC_BLOCK = /\/\*accents:begin\*\/[\s\S]*?\/\*accents:end\*\//g;
const check = process.argv.includes("--check");
let drift = 0;
for (const site of SITES) {
  const text = fs.readFileSync(site.file, "utf8");
  const found = text.match(BLOCK) || [];
  if (found.length !== 1) throw new Error(`${site.file}: expected exactly one tokens block, found ${found.length}`);
  let next = text.replace(BLOCK, () => `/*tokens:begin*/${site.render()}/*tokens:end*/`);
  if (site.file === "source/card.js" || site.file === front + "companion-panel.css") {
    if ((text.match(CP_BLOCK) || []).length !== 1) throw new Error(`${site.file}: expected exactly one cp block`);
    next = next.replace(CP_BLOCK, () => `/*cp:begin*/${cpTokens()}/*cp:end*/`);
  }
  if (site.file === "source/card.js") {
    if ((text.match(ACC_BLOCK) || []).length !== 1) throw new Error("source/card.js: expected exactly one accents block");
    next = next.replace(ACC_BLOCK, () => `/*accents:begin*/${accentsJs()}/*accents:end*/`);
  }
  if (next === text) continue;
  drift++;
  if (check) console.error(`Colour tokens out of date in ${site.file}`);
  else fs.writeFileSync(site.file, next);
}
for (const site of UI_SITES) {
  const text = fs.readFileSync(site.file, "utf8");
  if ((text.match(UI_BLOCK) || []).length !== 1) throw new Error(`${site.file}: expected exactly one ui block`);
  const css = sharedCss();
  if (site.js && /[`$]/.test(css)) throw new Error("source/companion-shared.css must not contain ` or $");
  const next = text.replace(UI_BLOCK, () => `/*ui:begin*/${site.js ? JSON.stringify(css) : css}/*ui:end*/`);
  if (next === text) continue;
  drift++;
  if (check) console.error(`Shared interface rules out of date in ${site.file}`);
  else fs.writeFileSync(site.file, next);
}
if (check && drift) process.exit(1);
console.log(check ? "Colour tokens match source/colour-tokens.json." : `Colour tokens written (${drift} file(s) changed).`);
