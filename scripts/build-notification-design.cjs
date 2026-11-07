/* Compile the user-supplied design without runtime CDNs or global demo handlers. */
const fs=require('fs'),path=require('path'),postcss=require('postcss'),tailwind=require('tailwindcss');
const base=path.resolve(__dirname,'..'),front=path.join(base,'custom_components/deepal_companion/frontend');
const source=fs.readFileSync(path.join(base,'source/notification-design.html'),'utf8');
const body=source.match(/<body\b[^>]*>([\s\S]*?)<script>/i)[1];
let controller=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)[1];
controller=controller.replaceAll('.replace(/{name}/g, "Deepal S05")','.replace(/{name}/g, String(hooks.values().name))').replaceAll('.replace(/{battery}/g, "67%")','.replace(/{battery}/g, String(hooks.values().battery))').replaceAll('.replace(/{range}/g, "579 km")','.replace(/{range}/g, String(hooks.values().range))');
controller=controller.replace('function showToast(msg) {','function showToast(msg) { if(hooks.silent())return;');
controller=controller.replace('function resetDefaults() {','function prototypeResetDefaults() {').replace('function saveNotificationConfig() {','function prototypeSaveNotificationConfig() {');
// The original functions remain intact; persistence and reset are supplied by HA.
controller+='\nfunction resetDefaults(){return hooks.reset();}\nfunction saveNotificationConfig(){return hooks.save();}\n';
controller=controller.replace('const max = parseInt(document.getElementById(\'input-max\').value) || 1;',"const max = repeat > 0 && hooks.repeatAllowed() ? parseInt(document.getElementById('input-max').value) || 1 : 1;");
controller=controller.replaceAll('lastFocusedInput.selectionStart || lastFocusedInput.value.length','lastFocusedInput.selectionStart ?? lastFocusedInput.value.length').replaceAll('lastFocusedInput.selectionEnd || lastFocusedInput.value.length','lastFocusedInput.selectionEnd ?? lastFocusedInput.value.length');
const icons={};for(const match of source.matchAll(/\bfa-([a-z][a-z0-9-]*)\b/g)){const name=match[1];if(['solid','regular'].includes(name))continue;for(const style of ['solid','regular']){const file=path.join(base,'node_modules/@fortawesome/fontawesome-free/svgs',style,name+'.svg');if(fs.existsSync(file)){icons[name]=fs.readFileSync(file,'utf8').replace(/<!--[^]*?-->/g,'');break;}}}
const dependency=name=>path.join(base,'node_modules',name);
const fontDir=path.join(front,'notification-assets/fonts');fs.mkdirSync(fontDir,{recursive:true});let fonts='';
for(const [pkg,family]of [['@fontsource-variable/inter','Deepal Design Inter'],['@fontsource-variable/jetbrains-mono','Deepal Design Mono']]){
 let css=fs.readFileSync(path.join(dependency(pkg),'wght.css'),'utf8');
 for(const match of css.matchAll(/url\(['"]?\.\/files\/([^)'"\s]+)['"]?\)/g)){fs.copyFileSync(path.join(dependency(pkg),'files',match[1]),path.join(fontDir,match[1]));}
 css=css.replace(/font-family:\s*'[^']+'/g,"font-family: '"+family+"'").replaceAll('./files/','./fonts/');fonts+=css+'\n';
 fs.copyFileSync(path.join(dependency(pkg),'LICENSE'),path.join(fontDir,pkg.split('/').at(-1)+'-LICENSE.txt'));
}
fs.writeFileSync(path.join(front,'notification-assets/fonts.css'),fonts);
fs.copyFileSync(path.join(dependency('@fortawesome/fontawesome-free'),'LICENSE.txt'),path.join(front,'notification-assets/Font-Awesome-LICENSE.txt'));
const color=(key,fallback)=>'rgb(var(--design-'+key+', '+fallback+') / <alpha-value>)';
const config={content:[{raw:source,extension:'html'}],theme:{extend:{colors:{darkbg:'var(--design-bg)',cardbg:'var(--design-card)',cardinner:'var(--design-inner)',cardborder:'var(--design-line)',emerald:{300:color('ok','52 211 153'),400:color('ok','52 211 153'),500:color('ok','52 211 153')},rose:{400:color('bad','248 113 113'),500:color('bad','248 113 113')},amber:{400:color('warn','250 204 21')},yellow:{400:color('warn','250 204 21')},accent:{emerald:color('ok','52 211 153'),emeraldDark:color('ok','52 211 153'),emeraldGlow:'rgba(var(--ds-ok),.18)',yellow:color('warn','250 204 21'),rose:color('bad','248 113 113')}}}}};
const custom=source.match(/<style>([\s\S]*?)<\/style>/i)[1].replace(/\bbody\s*\{/g,'.design-root {').replaceAll("'Inter'","'Deepal Design Inter'").replaceAll("'JetBrains Mono'","'Deepal Design Mono'");
postcss([tailwind(config)]).process('@tailwind base;@tailwind components;@tailwind utilities;\n'+custom,{from:undefined}).then(result=>{
 const tree=postcss.parse(result.css),colors={'#121316':'var(--design-bg)','#151619':'var(--design-inner)','#1b1c20':'var(--design-card)','#1f2025':'var(--design-soft)','#25282e':'var(--design-soft)','#2d3138':'var(--design-soft)','#24262c':'var(--design-line)','#282a30':'var(--design-line)','#32353b':'var(--design-line)','#9ca3af':'var(--design-muted)','#6b7280':'var(--design-muted)','#f3f4f6':'var(--design-fg)','#e5e7eb':'var(--design-fg)','#d1d5db':'var(--design-fg)','#34d399':'rgb(var(--design-ok))'};
 tree.walkDecls(decl=>{for(const [color,value]of Object.entries(colors))decl.value=decl.value.replaceAll(color,value);decl.value=decl.value.replace(/rgba\(52,\s*211,\s*153,\s*([\d.]+)\)/g,'rgba(var(--ds-ok),$1)');});
 const factory=`export function createDesignController(root,hooks){\nconst document={getElementById:id=>{const node=root.getElementById(id);return node?.type==='number'?new Proxy(node,{get:(target,key)=>{if(key==='value')return target.value||target.placeholder;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set:(target,key,value)=>Reflect.set(target,key,value,target)}):node;},querySelectorAll:selector=>root.querySelectorAll(selector),createElement:tag=>globalThis.document.createElement(tag)},window={};let toastTimer;const setTimeout=(fn,ms)=>{clearTimeout(toastTimer);toastTimer=globalThis.setTimeout(fn,ms);return toastTimer;};\n${controller}\nreturn {switchView,toggleMasterNotifications,toggleDevicePill,toggleQuietHours,setQuietMode,filterPresets,adjustValue,updateCalculations,setSeverity,setButtonOption,insertVariable,updateLivePreview,updateIcon,toggleCardState,resetDefaults,saveNotificationConfig,showToast,remember:input=>{lastFocusedInput=input;},destroy:()=>clearTimeout(toastTimer)};\n}`;
 fs.writeFileSync(path.join(front,'notification-design.js'),'/* Generated from source/notification-design.html; retain the supplied DOM and controller. */\nexport const designHtml='+JSON.stringify(body)+';\nexport const designCss='+JSON.stringify(tree.toString())+';\nexport const designIcons='+JSON.stringify(icons)+';\n'+factory);
 console.log('Supplied notification design compiled; local fonts and '+Object.keys(icons).length+' SVG icons.');
}).catch(error=>{console.error(error);process.exitCode=1;});
