// Static language guardrails (plain node, no browser). Run: node tests/test_language_keys.cjs
// Pass: node tests/test_language_keys.cjs --update-known   (rewrites tests/language_known_missing.json; review the diff)
// 1) The four card dictionaries (de, el, es, it) have identical key sets.
// 2) Every literal key used with T('...'), this.t('...') or panel.t('...') in source/*.js and frontend/*.js exists in at
//    least one dictionary. Known misses (English-only text such as units or brand names) are a ratchet stored in
//    tests/language_known_missing.json: only NEW misses fail the test.
// 3) translations/en.json and strings.json describe the same keys and values. Reported, never failing.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const COMP = path.join(ROOT, "custom_components", "deepal_companion");
const LANG_DIR = path.join(COMP, "frontend", "lang");
const FRONT = path.join(COMP, "frontend");
const SOURCE = path.join(ROOT, "source");
const KNOWN_FILE = path.join(__dirname, "language_known_missing.json");
const CODES = ["de", "el", "es", "it"];
const PRINT_LIMIT = 30, PARITY_LIMIT = 20;
const updateKnown = process.argv.includes("--update-known");
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
let failed = false;

// Load the dictionaries the same way the language audit does: the file sets window.__DEEPAL_COMPANION_LANGS[code].dict.
function loadDicts() {
  const out = {};
  for (const code of CODES) {
    const ctx = { window: {} };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(LANG_DIR, code + ".js"), "utf8"), ctx, { filename: code + ".js" });
    out[code] = ctx.window.__DEEPAL_COMPANION_LANGS[code].dict;
  }
  return out;
}

// 1) Key-set parity
const dicts = loadDicts();
const union = new Set();
for (const code of CODES) for (const key of Object.keys(dicts[code])) union.add(key);
console.log(`dictionary keys: ${union.size} (union); per language: ${CODES.map((c) => `${c}=${Object.keys(dicts[c]).length}`).join(" ")}`);
let parityFailed = false;
for (const code of CODES) {
  const missing = [...union].filter((key) => !has(dicts[code], key));
  if (!missing.length) continue;
  failed = true; parityFailed = true;
  console.log(`FAIL parity: ${code} is missing ${missing.length} key(s)`);
  for (const key of missing.slice(0, PARITY_LIMIT)) console.log(`   ${JSON.stringify(key)}`);
  if (missing.length > PARITY_LIMIT) console.log(`   ... ${missing.length - PARITY_LIMIT} more`);
}
if (!parityFailed) console.log("PASS parity: the four dictionaries have identical key sets");

// 2) Literal keys used in code and missing from every dictionary
const files = [
  ...fs.readdirSync(SOURCE).filter((f) => f.endsWith(".js")).map((f) => path.join(SOURCE, f)),
  ...fs.readdirSync(FRONT).filter((f) => f.endsWith(".js")).map((f) => path.join(FRONT, f)),
];
// T('..') / T("..") / this.t(..) / panel.t(..) where the literal is the whole argument (followed by , or )).
const CALL = /(?<![\w$.])(?:T|this\.t|panel\.t)\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)')(?=\s*[,)])/g;
const unescape = (raw) => raw.replace(/\\(.)/g, (m, c) => ({ n: "\n", t: "\t" })[c] ?? c);
const firstSeen = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  for (const match of text.matchAll(CALL)) {
    const key = unescape(match[1] ?? match[2] ?? "");
    if (!key || union.has(key) || firstSeen.has(key)) continue;
    const line = text.slice(0, match.index).split("\n").length;
    firstSeen.set(key, `${rel}:${line}`);
  }
}
const misses = [...firstSeen.keys()].sort();
const knownList = fs.existsSync(KNOWN_FILE) ? JSON.parse(fs.readFileSync(KNOWN_FILE, "utf8")) : [];
const known = new Set(knownList);
if (updateKnown) {
  fs.writeFileSync(KNOWN_FILE, JSON.stringify(misses, null, 2) + "\n", "utf8");
  console.log(`wrote ${misses.length} known miss(es) to ${path.relative(ROOT, KNOWN_FILE)}`);
}
const newMisses = misses.filter((key) => !known.has(key));
const fixedSince = knownList.filter((key) => union.has(key));
console.log(`literal keys without a translation: ${misses.length} (known: ${misses.length - newMisses.length}, new: ${newMisses.length})`);
for (const key of misses.slice(0, PRINT_LIMIT)) console.log(`   ${known.has(key) ? "[known]" : "[NEW]  "} ${JSON.stringify(key)}  ${firstSeen.get(key)}`);
if (misses.length > PRINT_LIMIT) console.log(`   ... ${misses.length - PRINT_LIMIT} more`);
if (fixedSince.length) console.log(`note: ${fixedSince.length} known miss(es) now have a translation; rerun with --update-known to shrink the list`);
if (!updateKnown && newMisses.length) {
  failed = true;
  console.log(`FAIL misses: ${newMisses.length} new key(s) without a translation in de/el/es/it (add them to the lang files)`);
  for (const key of newMisses.slice(0, PARITY_LIMIT)) console.log(`   NEW ${JSON.stringify(key)}  ${firstSeen.get(key)}`);
} else if (!updateKnown) console.log("PASS misses: no new literal key lacks a translation");

// 3) translations/en.json and strings.json parity (report only)
const stringsFile = path.join(COMP, "strings.json"), enFile = path.join(COMP, "translations", "en.json");
if (fs.existsSync(stringsFile) && fs.existsSync(enFile)) {
  const flat = (value, prefix = "", out = new Map()) => {
    if (value && typeof value === "object" && !Array.isArray(value)) for (const [k, v] of Object.entries(value)) flat(v, prefix ? `${prefix}.${k}` : k, out);
    else out.set(prefix, JSON.stringify(value));
    return out;
  };
  const a = flat(JSON.parse(fs.readFileSync(stringsFile, "utf8"))), b = flat(JSON.parse(fs.readFileSync(enFile, "utf8")));
  const differ = [...new Set([...a.keys(), ...b.keys()])].sort().filter((k) => a.get(k) !== b.get(k));
  if (!differ.length) console.log("PASS en.json: translations/en.json matches strings.json");
  else {
    console.log(`REPORT en.json differs from strings.json at ${differ.length} key(s) (not failing; regenerate en.json from strings.json if that is the intent):`);
    for (const k of differ.slice(0, PARITY_LIMIT)) console.log(`   ${k}: strings=${a.get(k) ?? "(absent)"} en=${b.get(k) ?? "(absent)"}`);
  }
} else console.log("skip en.json: strings.json or translations/en.json is missing");

if (failed) { console.log("RESULT: FAIL"); process.exitCode = 1; }
else console.log("RESULT: PASS");
