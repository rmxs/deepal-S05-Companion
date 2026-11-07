/* Compile the supplied Costs HTML locally; its demo data/handlers are never run. */
const fs=require('fs'),path=require('path'),postcss=require('postcss'),tailwind=require('tailwindcss');
const base=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(base,'source/cost-design.html'),'utf8'),body=source.match(/<body\b[^>]*>([\s\S]*?)<script>/i)[1];
const color=(role,fallback)=>`rgb(var(--cost-${role}, ${fallback}) / <alpha-value>)`;
const config={corePlugins:{preflight:false},content:[{raw:source,extension:'html'}],theme:{extend:{colors:{emerald:{300:color('ok','99 203 163'),400:color('ok','99 203 163'),500:color('ok','99 203 163')},yellow:{400:color('warn','250 204 21')},rose:{400:color('bad','248 113 113')},blue:{400:color('info','121 173 255')},accent:{emerald:color('ok','99 203 163'),yellow:color('warn','250 204 21'),rose:color('bad','248 113 113'),blue:color('info','121 173 255')}}}}};
const custom=source.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\bbody\s*\{/g,'.supplied-costs {').replace(/font-family:\s*'[^']+'[^;]*;/g,'font-family:inherit;');
postcss([tailwind(config)]).process('@tailwind components;@tailwind utilities;\n'+custom,{from:undefined}).then(result=>{
 const tree=postcss.parse(result.css),colors={'#121316':'var(--primary-background-color)','#1b1d20':'var(--card-background-color)','#222428':'color-mix(in srgb,var(--card-background-color) 93%,#fff)','#32353b':'var(--divider-color)','#2d3036':'var(--divider-color)','#2d3138':'var(--divider-color)','#9ca3af':'var(--secondary-text-color)','#f3f4f6':'var(--primary-text-color)','#e5e7eb':'var(--primary-text-color)','#34d399':'rgb(var(--cost-ok))'};
 tree.walkDecls(decl=>{for(const [hex,value]of Object.entries(colors))decl.value=decl.value.replaceAll(hex,value);decl.value=decl.value.replace(/rgba\(52,\s*211,\s*153,\s*([\d.]+)\)/g,'rgb(var(--cost-ok) / $1)');});
 tree.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes/.test(rule.parent.name))return;rule.selectors=rule.selectors.map(selector=>selector.startsWith('.supplied-costs')?selector:'.supplied-costs '+selector);});
 fs.writeFileSync(path.join(base,'custom_components/deepal_companion/frontend/cost-design.js'),'/* Generated from source/cost-design.html. */\nexport const costHtml='+JSON.stringify(body)+';\nexport const costCss='+JSON.stringify(tree.toString())+';\n');
 console.log('Supplied Costs HTML compiled without runtime fonts or CDNs.');
}).catch(error=>{console.error(error);process.exitCode=1;});
