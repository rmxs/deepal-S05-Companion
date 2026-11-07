const assert=require("assert"),fs=require("fs"),path=require("path");
module.exports=async page=>{
  const report=[];
  const panel=page.locator("deepal-companion-panel");
  for(const width of [1440,1024,768,430,390,360]){
    await page.setViewportSize({width,height:1000});
    for(const mode of ["settings","chargers","history"]){
      try { await panel.locator('[data-mode="'+mode+'"]').click({timeout:5000}); }
      catch(error){
        console.log('LAYOUT_NAV_FAILURE',await panel.evaluate(root=>({width:innerWidth,height:innerHeight,scrollY,host:root.getBoundingClientRect().toJSON(),nav:root.shadowRoot.querySelector('nav').getBoundingClientRect().toJSON(),style:getComputedStyle(root.shadowRoot.querySelector('nav')).cssText})),{width,mode});
        await page.screenshot({path:path.resolve(__dirname,'../layout-navigation-failure.png'),fullPage:true});
        throw error;
      }
      if(mode==="settings")await page.waitForFunction(()=>!!document.querySelector("deepal-companion-panel").preview?._c);
      if(mode==="settings")await panel.evaluate(root=>root.settings._setTab('colours'));
      if(mode==="chargers")await panel.locator(".cc-profile").first().waitFor({state:"attached"});
      if(mode==="history")await panel.locator(".archive .charge-session-list").waitFor();
      await page.waitForTimeout(200);
      const sizes=await panel.evaluate(root=>{
        const main=root.shadowRoot.querySelector("main").getBoundingClientRect(),stage=root.shadowRoot.querySelector(".stage").getBoundingClientRect();
        const profile=root.shadowRoot.querySelector(".profile-controls");
        const frame=root.shadowRoot.querySelector(".preview-window"),preview=root.preview?.getBoundingClientRect();
        return {horizontal:document.documentElement.scrollWidth>innerWidth+1,mainLeft:main.left,mainRight:main.right,stageLeft:stage.left,stageRight:stage.right,
          profileFits:!profile||profile.scrollWidth<=profile.clientWidth+1,
          settingsFits:!root.settings||root.settings.scrollWidth<=root.settings.clientWidth+1,
          previewFits:!frame||!!preview&&preview.left>=frame.getBoundingClientRect().left-1&&preview.right<=frame.getBoundingClientRect().right+1&&preview.bottom<=frame.getBoundingClientRect().bottom+1};
      });
      assert.equal(sizes.horizontal,false,mode+" horizontal page overflow at "+width);
      assert(sizes.mainLeft>=-1&&sizes.mainRight<=width+1,mode+" main bounds at "+width);
      assert(sizes.stageLeft>=-1&&sizes.stageRight<=width+1,mode+" settings bounds at "+width);
      assert.equal(sizes.profileFits,true,"Profile controls overflow at "+width);
      assert.equal(sizes.settingsFits,true,"Settings controls overflow at "+width);
      assert.equal(sizes.previewFits,true,"Preview clipping at "+width);
      if(mode==='settings'){
        const colours=await panel.evaluate(root=>{
          const sr=root.settings.shadowRoot,swatch=sr.querySelector('.sw-c input[type=color]'),r=swatch.getBoundingClientRect();
          return {scroll:sr.querySelector('.tabs').scrollWidth>sr.querySelector('.tabs').clientWidth+1,swatchWidth:r.width,swatchHeight:r.height,radius:parseFloat(getComputedStyle(swatch).borderRadius),labels:[...sr.querySelectorAll('.sw-c span')].map(n=>n.textContent)};
        });
        assert.equal(colours.scroll,false,'Settings menu must fit without scrolling at '+width);
        assert(colours.swatchWidth>colours.swatchHeight,'Swatches must be rectangular at '+width);
        assert(colours.radius<colours.swatchHeight/2,'Swatches must not be circular at '+width);
        assert.deepEqual(colours.labels,['Cool','Mild','Warm','Red','Orange','Yellow','Green']);
        for(const tab of ['layout','look','controls','charge','colours','sensors','notify','vehicle']){
          const fits=await panel.evaluate((root,tab)=>{
            root.settings._setTab(tab);
            const widget=root.settings,sr=widget.shadowRoot,bounds=widget.getBoundingClientRect();
            return widget.scrollWidth<=widget.clientWidth+1&&[...sr.querySelectorAll('input,select,.grp,.tabs')].filter(n=>n.getClientRects().length).every(n=>{const r=n.getBoundingClientRect();return r.left>=bounds.left-1&&r.right<=bounds.right+1;});
          },tab);
          assert.equal(fits,true,tab+' fields overflow at '+width);
        }
        await panel.evaluate(root=>root.settings._setTab('colours'));
        if(width===1440||width===390)await page.screenshot({path:path.resolve(__dirname,'../settings-colours-'+width+'.png'),fullPage:true});
      }
      report.push({width,mode,passed:true});
    }
  }
  await panel.locator('[data-mode="settings"]').click();
  await page.waitForFunction(()=>!!document.querySelector("deepal-companion-panel").preview);
  fs.writeFileSync(path.resolve(__dirname,"../LAYOUT_VALIDATION.json"),JSON.stringify(report,null,2)+"\n");
  console.log("PASS: 18 responsive layouts, including 360/390/430 px mobile widths.");
};
