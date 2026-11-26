/* Language sweep: renders the dashboard pages and the card in every secondary language and reports visible text
 * (text nodes, titles, aria-labels, placeholders) that is still an English key of the dictionary, or that looks
 * like English and has no dictionary entry. Run: LANG_ONLY=1 node tests/test_browser.cjs */
const assert=require('assert');
module.exports=async page=>{
  const langs=(process.env.LANGS||'el,de,es,it').split(',');
  const collect=()=>page.evaluate(()=>{
    const out=[];
    const walk=root=>{
      const stack=[root];
      while(stack.length){
        const node=stack.pop();
        if(node.nodeType===3){const t=node.nodeValue.replace(/\s+/g,' ').trim();if(t&&!['STYLE','SCRIPT'].includes(node.parentElement?.tagName))out.push(t);continue;}
        if(node.nodeType===1){
          if(['STYLE','SCRIPT','svg','SVG'].includes(node.tagName))continue;
          for(const a of ['title','aria-label','placeholder','alt'])if(node.getAttribute&&node.getAttribute(a))out.push(node.getAttribute(a));
          if(node.shadowRoot)stack.push(node.shadowRoot);
        }
        for(const child of node.childNodes||[])stack.push(child);
      }
    };
    walk(document.body);
    return out;
  });
  for(const lang of langs)await page.addScriptTag({url:'/deepal_companion/frontend/lang/'+lang+'.js'});
  const dicts=await page.evaluate(()=>Object.fromEntries(Object.entries(window.__DEEPAL_COMPANION_LANGS||{}).map(([k,v])=>[k,v.dict])));
  const report={};
  const panelEval=fn=>page.evaluate(fn);
  for(const lang of langs){
    const dict=dicts[lang];assert(dict,'dictionary '+lang);
    await page.evaluate(language=>{window.testHass.locale.language=language;window.testHass.language=language;
      document.querySelector('deepal-companion-panel')?.remove();
      const panel=document.createElement('deepal-companion-panel');document.querySelector('#panel').append(panel);panel.hass=window.testHass;},lang);
    await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings?._cfg,null,{timeout:20000}).catch(()=>{});
    const seen=new Map();let where='start';
    const snap=async()=>{for(const t of await collect())if(!seen.has(t))seen.set(t,where);};
    await snap();
    const panel=page.locator('deepal-companion-panel');
    // every settings tab, then every other page; open every collapsible section on the way
    const tabs=await page.evaluate(()=>[...document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelectorAll('[data-tab]')].map(b=>b.dataset.tab));
    for(const tab of tabs){where='tab '+tab;
      await page.evaluate(t=>{const s=document.querySelector('deepal-companion-panel').settings.shadowRoot;s.querySelector('[data-tab="'+t+'"]')?.click();s.querySelectorAll('details').forEach(d=>d.open=true);},tab);
      await page.waitForTimeout(150);await snap();
    }
    for(const mode of ['notifications','history','chargers','preconditioning','logs','health']){where='page '+mode;
      await page.evaluate(m=>{const p=document.querySelector('deepal-companion-panel');p.shadowRoot.querySelector('nav [data-mode="'+m+'"]')?.click();},mode);
      await page.waitForTimeout(700);
      await page.evaluate(()=>{const walk=r=>{r.querySelectorAll?.('details').forEach(d=>d.open=true);r.querySelectorAll?.('*').forEach(e=>e.shadowRoot&&walk(e.shadowRoot));};walk(document.body);});
      await snap();
      // open the first rule / row editors so their forms are covered too
      await page.evaluate(()=>{const p=document.querySelector('deepal-companion-panel');const r=p.shadowRoot;r.querySelectorAll('[data-rule],[data-edit],.rule-row,[data-open-rule]').forEach((e,i)=>{if(i<4)e.click?.();});});
      await page.waitForTimeout(200);await snap();
    }
    // the card: press every control button in the preview and read the sheet that opens
    await page.evaluate(()=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector('nav [data-mode="settings"]')?.click());
    await page.waitForTimeout(500);
    const buttons=await page.evaluate(()=>{const find=r=>{const c=r.querySelector?.('deepal-companion-card');if(c)return c;for(const e of r.querySelectorAll?.('*')||[])if(e.shadowRoot){const f=find(e.shadowRoot);if(f)return f;}return null;};const card=find(document.querySelector('deepal-companion-panel').shadowRoot);return card?[...card.shadowRoot.querySelectorAll('button.act,[data-id],[data-sheet]')].length:0;});
    for(let i=0;i<buttons;i++){where='card button '+i;
      await page.evaluate(index=>{const find=r=>{const c=r.querySelector?.('deepal-companion-card');if(c)return c;for(const e of r.querySelectorAll?.('*')||[])if(e.shadowRoot){const f=find(e.shadowRoot);if(f)return f;}return null;};const card=find(document.querySelector('deepal-companion-panel').shadowRoot);card.shadowRoot.querySelectorAll('button.act,[data-id],[data-sheet]')[index]?.click();},i);
      await page.waitForTimeout(120);await snap();
      await page.evaluate(()=>{const find=r=>{const c=r.querySelector?.('deepal-companion-card');if(c)return c;for(const e of r.querySelectorAll?.('*')||[])if(e.shadowRoot){const f=find(e.shadowRoot);if(f)return f;}return null;};find(document.querySelector('deepal-companion-panel').shadowRoot)?._closeSheet?.();});
    }
    const untranslated=[],unknown=[],values=new Set(Object.values(dict));
    for(const [text,place] of seen){
      if(Object.prototype.hasOwnProperty.call(dict,text)&&dict[text]===text)continue;
      if(Object.prototype.hasOwnProperty.call(dict,text)){
        // present as a key and shown unchanged → the page never translated it
        untranslated.push(text+'  @'+place);continue;
      }
      if(/^[A-Z][a-z]+(?: [A-Za-z’'.,:&()/-]+){1,}$/.test(text)&&!/[Ͱ-Ͽ]/.test(text))unknown.push(text);
    }
    const latin=[...seen].filter(([t])=>/^[\x20-\x7e’—–·…°]+$/.test(t)&&/[A-Za-z]{2}/.test(t)&&!values.has(t)).map(([t,w])=>t+'  @'+w);
    report[lang]={untranslated:untranslated.sort(),unknown:unknown.sort(),latin:latin.sort()};
  }
  require('fs').writeFileSync(process.env.LANG_REPORT||'language-sweep.json',JSON.stringify(report,null,1));
  for(const [lang,r] of Object.entries(report))console.log(lang,'untranslated keys shown:',r.untranslated.length,'| English-looking unknown:',r.unknown.length);
  /* Gate: a text that has a translation but is shown in English fails the run. Known intentional items are listed here. */
  const allowed=new Set(['Choose an entity  @start']);
  const drift=Object.entries(report).flatMap(([lang,r])=>r.untranslated.filter(t=>!allowed.has(t)).map(t=>lang+': '+t));
  assert.equal(drift.length,0,'Translated texts shown in English:\n'+drift.join('\n'));
};
