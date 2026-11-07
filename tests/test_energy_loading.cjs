const assert=require('assert');
module.exports=async page=>{
  await page.evaluate(async()=>{const card=document.getElementById('mobile'),host=document.createElement('div');host.id='energy-loading-test';host.style.cssText='max-width:700px;margin:auto';document.body.append(host);await window.__DEEPAL_COMPANION_ENERGY.panel(host,card);});
  const host=page.locator('#energy-loading-test');await host.locator('.en-now').waitFor();
  await page.evaluate(()=>{window.historyDelayMS=700;const host=document.getElementById('energy-loading-test');window.oldEnergyBody=host.querySelector('.en-body');window.oldEnergyNow=host.querySelector('.en-now');window.oldEnergyHeight=window.oldEnergyBody.getBoundingClientRect().height;});
  await host.locator('[data-period="30"]').click();await host.locator('.en-period-loader').waitFor();
  assert(await page.evaluate(()=>{const host=document.getElementById('energy-loading-test'),body=host.querySelector('.en-body');return body===window.oldEnergyBody&&body.querySelector('.en-now')===window.oldEnergyNow&&body.getBoundingClientRect().height>=window.oldEnergyHeight-1&&!!body.querySelector('.en-cw .en-period-loader');}),'Period changes must preserve the card and put loading inside the chart');
  await host.locator('.en-period-loader').waitFor({state:'detached'});assert.equal(await host.locator('.en-now').count(),1);
  const price=host.locator('.cc-session').first();await price.waitFor();
  const spacing=await price.evaluate(node=>{const heading=node.closest('.cc-session-row').previousElementSibling;return {gap:node.getBoundingClientRect().top-heading.getBoundingClientRect().bottom,badge:!!node.querySelector('.cc-price-badge b'),note:!!node.querySelector('.cc-location-name+small')};});
  assert(spacing.gap>=4&&spacing.badge&&spacing.note,'Charging prices must have separate spacing, a price badge and an estimate note');
  await host.locator('[data-cc=curve]').first().click();await page.locator('.archived-curve-dialog .charging-curve-block').waitFor();await page.keyboard.press('Escape');await page.locator('.archived-curve-dialog').waitFor({state:'detached'});
  await page.evaluate(()=>{window.historyDelayMS=0;const host=document.getElementById('energy-loading-test');host.energyCleanup?.();host.remove();});
  console.log('PASS: weekly/monthly loading preserves panel height and content, with chart-local loader and spaced charging-price details.');
};
