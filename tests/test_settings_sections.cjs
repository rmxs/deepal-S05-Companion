const assert=require('assert');
/* Regression test for the collapsible settings sections (DeepalS05Settings._render in source/card.js).
   Default: every section of every tab is closed (empty storage). A click on a header toggles it without a re-render
   and saves the state of the tab's sections in this browser. "all" opens everything. A closed section keeps its controls
   in the DOM. Restores the "all" storage value that tests/test_browser.cjs relies on. */
/* The build renames the deepal-s05 prefix to deepal-companion, so the shipped card stores its state under this key. */
const KEY='deepal-companion-settings-sections';
module.exports=async page=>{
  const widget=page.locator('deepal-companion-panel').locator('deepal-companion-settings');
  const setTab=async tab=>{
    await page.evaluate(t=>document.querySelector('deepal-companion-panel').settings._setTab(t),tab);
    await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').settings._tabLoading);
  };
  const rerender=()=>page.evaluate(()=>document.querySelector('deepal-companion-panel').settings._render());
  const sections=()=>page.evaluate(()=>[...document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelectorAll('.grp')].map(s=>{
    const h=s.querySelector(':scope > .gh');
    return {sec:s.dataset.sec,closed:s.classList.contains('cl'),aria:h?h.getAttribute('aria-expanded'):null,badge:s.querySelector('.gn')?.textContent.trim()??null,tag:h?h.tagName:null};
  }));
  const stored=()=>page.evaluate(k=>localStorage.getItem(k),KEY);
  const find=(list,id)=>{const s=list.find(x=>x.sec===id);assert(s,'Missing section '+id);return s;};
  const assertState=(s,open,label)=>{
    assert.equal(s.closed,!open,label+': "cl" class should be '+(!open)+' (sec '+s.sec+')');
    assert.equal(s.aria,String(open),label+': aria-expanded should be '+open+' (sec '+s.sec+')');
  };
  /* Level and Airflow colours are Advanced sections now (the Appearance tab has Style, Car image and Car View, Messages). */
  const level='advanced:Level colours', air='advanced:Airflow colours';
  try{
    /* 0. Regression: with empty storage, every section of every tab starts closed. */
    const tabKeys=await page.evaluate(()=>[...document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelectorAll('[data-tab]')].map(b=>b.dataset.tab));
    assert(tabKeys.length>=5,'Settings tabs not found: '+tabKeys.join(', '));
    let checked=0;
    for(const tab of tabKeys){
      await setTab(tab);
      await page.evaluate(k=>localStorage.removeItem(k),KEY);
      await rerender();
      const all=await sections();
      checked+=all.length;
      const open=all.filter(s=>!s.closed||s.aria!=='false').map(s=>s.sec);
      assert.deepEqual(open,[],tab+': no settings section may start open with empty storage');
    }
    assert(checked>=10,'Too few settings sections checked on every tab: '+checked);

    /* 1. Defaults: no stored state, every section closed. Appearance: Style, Car image and Car View and Messages closed. */
    await setTab('look');
    await page.evaluate(k=>localStorage.removeItem(k),KEY);
    await rerender();
    let list=await sections();
    assert.deepEqual(list.map(s=>s.sec),['look:Style','look:Car image and Car View','look:Messages'],'Appearance sections');
    list.forEach(s=>assertState(s,false,'default Appearance'));
    assert.equal(find(list,'look:Style').badge,null,'Style shows no basic controls (the tile icon colour settings were removed)');
    assert.equal(find(list,'look:Messages').badge,'4','Messages should show 4 controls');

    /* 1b. Advanced: every section closed. Level colours (10) and Airflow colours (5) keep their controls in the DOM. */
    await setTab('advanced');
    await page.evaluate(k=>localStorage.removeItem(k),KEY);
    await rerender();
    list=await sections();
    assert(list.length>=3,'Advanced should have at least three sections, found '+list.length);
    list.forEach(s=>assertState(s,false,'default Advanced'));
    assert.equal(find(list,level).badge,'10','Level colours should show 10 controls');
    assert.equal(find(list,air).badge,'5','Airflow colours should show 5 controls');
    const inside=await page.evaluate(sec=>{
      const s=document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-sec="'+sec+'"]');
      const n=s&&s.querySelector('[data-set="lvl_red"]');
      return {present:!!n,visible:!!n&&n.getClientRects().length>0,closed:!!s&&s.classList.contains('cl')};
    },level);
    assert(inside.present,'A closed section must keep its controls in the DOM (lvl_red not found in Level colours)');
    assert.equal(find(list,level).closed,true,'Level colours should start closed');
    assert.equal(inside.visible,false,'Controls of a closed section must be hidden');

    /* 2. Clicking a closed header opens it; the choice persists across re-render and tab switches; a second click closes it. */
    const untouched=list.find(s=>s.closed&&s.sec!==level).sec;
    await widget.locator('[data-sec="'+level+'"] > .gh').click();
    list=await sections();
    assertState(find(list,level),true,'after click');
    assertState(find(list,untouched),false,'untouched section after click');
    const saved=JSON.parse(await stored());
    assert.equal(saved[level],true,'Opened state must be saved');
    assert.equal(saved[untouched],false,'Closed state of an untouched section must be saved');
    await rerender();
    list=await sections();
    assertState(find(list,level),true,'after re-render');
    assertState(find(list,untouched),false,'untouched after re-render');
    await setTab('controls');
    await setTab('advanced');
    list=await sections();
    assertState(find(list,level),true,'after switching tab and back');
    assertState(find(list,untouched),false,'untouched after switching tab and back');
    await widget.locator('[data-sec="'+level+'"] > .gh').click();
    list=await sections();
    assertState(find(list,level),false,'after second click');
    assert.equal(JSON.parse(await stored())[level],false,'Closed state must be saved');

    /* 3. "all" opens every section. */
    await page.evaluate(k=>localStorage.setItem(k,JSON.stringify('all')),KEY);
    await rerender();
    list=await sections();
    assert(list.length>=3,'Appearance sections missing after "all"');
    assert.equal(list.filter(s=>s.closed).length,0,'"all" must open every section; closed: '+list.filter(s=>s.closed).map(s=>s.sec).join(', '));
    list.forEach(s=>assert.equal(s.aria,'true','"all": aria-expanded should be true (sec '+s.sec+')'));

    /* 3b. One real badge per tab, read from the page: the number of controls in that section. */
    const badges={layout:['layout:Sections','9'],look:['look:Messages','4'],controls:['controls:Climate','2'],charge:['charge:Charging on the card','2'],vehicle:['vehicle:Vehicle setup','5'],advanced:[level,'10']};
    for(const [tab,[sec,badge]]of Object.entries(badges)){
      await setTab(tab);
      await rerender();
      list=await sections();
      assert.equal(find(list,sec).badge,badge,tab+': '+sec+' should show '+badge+' controls');
    }

    /* 4. Controls and Vehicle tabs render headers as buttons; Enter and Space toggle them from the keyboard. */
    await page.evaluate(k=>localStorage.removeItem(k),KEY);
    for(const tab of ['controls','vehicle']){
      await setTab(tab);
      await rerender();
      list=await sections();
      assert(list.length>=1,tab+': no sections rendered');
      assert.equal(list.filter(s=>s.tag==='BUTTON').length,list.length,tab+': every section header must be a button');
      const first=widget.locator('.grp > .gh').first();
      const before=await first.getAttribute('aria-expanded');
      await first.focus();
      await page.keyboard.press('Enter');
      const afterEnter=await first.getAttribute('aria-expanded');
      assert.notEqual(afterEnter,before,tab+': Enter must toggle the focused header');
      await page.keyboard.press('Space');
      const afterSpace=await first.getAttribute('aria-expanded');
      assert.equal(afterSpace,before,tab+': Space must toggle the focused header back');
    }
  }finally{
    /* Later tests expect every section open. */
    await page.evaluate(k=>localStorage.setItem(k,JSON.stringify('all')),KEY);
  }
  console.log('PASS: settings sections default open/closed, toggle and persist, "all", keyboard on Controls and Vehicle.');
};
