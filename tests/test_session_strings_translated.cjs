/* The Sessions page, the Deleted charges dialog and the charge dialogs show translated text: every string they pass to the
   translator exists in all four secondary languages, and the plain English literals are no longer written straight into the markup. */
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const frontend=path.join(__dirname,'..','custom_components','deepal_companion','frontend');
const dictionaries={};
for(const lang of ['el','de','es','it']){const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(frontend,'lang',lang+'.js'),'utf8'),sandbox);dictionaries[lang]=sandbox.window.__DEEPAL_COMPANION_LANGS[lang].dict;}
const sources=[['companion-cost-design.js',/panel\.t\('((?:[^'\\]|\\.)*)'/g],['companion-panel.js',/this\.t\('((?:[^'\\]|\\.)*)'/g],['charging-curve.js',/\btr\('((?:[^'\\]|\\.)*)'/g]];
const keys=new Set(['{0} day left','{0} days left']);
for(const [file,pattern] of sources){const text=fs.readFileSync(path.join(frontend,file),'utf8');for(const m of text.matchAll(pattern))keys.add(m[1].replace(/\\'/g,"'"));}
for(const lang of Object.keys(dictionaries))for(const key of keys)assert(dictionaries[lang][key],'Missing '+lang+' translation: '+key);
const panel=fs.readFileSync(path.join(frontend,'companion-panel.js'),'utf8'),design=fs.readFileSync(path.join(frontend,'companion-cost-design.js'),'utf8');
for(const raw of ['>Export JSON<','>Database backup<','>Import older Recorder charges<','>All locations<','>Not set<','>Load more<'])assert(!panel.includes(raw)&&!design.includes(raw),'Untranslated markup: '+raw);
for(const raw of ["confirmDialog('Delete this charge?'","status('Charge deleted.","'Charging charts could not be loaded.'"])assert(!panel.includes(raw)||panel.includes('this.t('+raw.slice(raw.indexOf("'"))),'Untranslated text: '+raw);
console.log('PASS: session list, deleted charges and charge dialogs use translated text ('+keys.size+' strings in 4 languages).');
