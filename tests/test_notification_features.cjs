/* Real-usage check of the notification features of 0.1.6: Advanced conditions, "Why isn't it sending?" with the ? explanations, the unread badge and the Greek/Spanish texts. Everything is mocked. */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const frontend = path.resolve(__dirname, '../custom_components/deepal_companion/frontend');
function dictionary(code) { const window = {}; vm.runInNewContext(fs.readFileSync(path.join(frontend, 'lang', code + '.js'), 'utf8'), {window}); return window.__DEEPAL_COMPANION_LANGS[code].dict; }
module.exports = async page => {
  /* 1. Greek and Spanish: every text of the new settings and explanations has a translation */
  const rules = fs.readFileSync(path.join(frontend, 'notification-rules.js'), 'utf8'), design = fs.readFileSync(path.join(frontend, 'companion-notifications-design.js'), 'utf8');
  const start = rules.indexOf('/* Advanced conditions'), end = rules.indexOf('function context(');
  const wanted = new Set(['Advanced conditions', 'Send when', 'any of these is true', 'all of these are true', '+ Add condition', 'Remove condition', 'Car on, not moving for', 'What is this?', 'Now:', 'Could not be checked.', 'for at least', 'Only when the car is parked', 'changed {0} min ago', 'odometer last changed {0} min ago']);
  for (const m of rules.slice(start, end).matchAll(/(?:label|help): "((?:[^"\\]|\\.)*)"|\["[a-z]+", "((?:[^"\\]|\\.)*)"\]|T\("((?:[^"\\]|\\.)*)"/g)) { const t = (m[1] || m[2] || m[3] || '').replace(/\\"/g, '"'); if (t) wanted.add(t); }
  for (const m of rules.slice(start, end).matchAll(/BASE_(?:LABEL|HELP) = \{([^}]*)\}/gs)) for (const v of m[1].matchAll(/: "((?:[^"\\]|\\.)*)"/g)) wanted.add(v[1]);
  for (const code of ['el', 'es']) { const dict = dictionary(code), missing = [...wanted].filter(t => t.length > 3 && dict[t] === undefined && !/^(Power|Engine|Odometer|Doors|Lights|Windows|Climate|Charging)$/.test(t)); assert.deepEqual(missing.filter(t => /[A-Za-z]{4}/.test(t) && !/^[a-z_]+$/.test(t) && !t.includes('${')), [], code + ': missing translations'); }
  /* 2. the editor */
  const panel = page.locator('deepal-companion-panel');
  await page.setViewportSize({width: 1100, height: 900});
  await panel.evaluate(p => { const s = window.testHass.states, old = new Date(Date.now() - 600000).toISOString(); for (const [id, v] of [['sensor.s05_power_status', 'on'], ['sensor.s05_total_odometer', '1000'], ['lock.s05_doors', 'unlocked'], ['binary_sensor.s05_engine', 'off']]) s[id] = {entity_id: id, state: v, attributes: {}, last_changed: old, last_updated: old}; });
  await panel.evaluate(p => p.navigateMode('notifications'));
  const board = panel.locator('.supplied-notification-design'); await board.waitFor();
  await board.locator('[data-alert-id=unlocked] [data-alert-open]').first().click();
  const detail = board.locator('#view-detail'); await detail.waitFor({state: 'visible'});
  assert.equal(await board.locator('#input-park').count(), 0, 'the old Parked for field is gone');
  assert.equal(await board.locator('#input-wait').count(), 1, 'Car on, not moving for');
  assert(await board.locator('.adv-box').count() >= 1, 'Advanced conditions box');
  assert.equal(await board.locator('.adv-row').count(), 0, 'Advanced is off by default');
  const parked = board.locator('[data-condition=parked]'); assert.equal(await parked.count(), 1);
  await board.locator('[data-adv=on]').locator('..').click();
  assert(await board.locator('.adv-row').count() >= 1, 'switching it on shows rows');
  assert.equal(await board.locator('[data-condition=parked]').count(), 0, 'the parked switch is replaced by the rows');
  await board.locator('[data-adv-act=add]').click();
  const rows = await board.locator('.adv-row').count(), last = board.locator('.adv-row').last();
  await last.locator('[data-adv=s]').selectOption('odo'); await board.locator('.adv-row').last().locator('[data-adv=v]').selectOption('still');
  await board.locator('.adv-row').last().locator('[data-adv=t]').fill('30'); await board.locator('.adv-row').last().locator('[data-adv=t]').dispatchEvent('change');
  await board.locator('[data-adv=mode]').selectOption('all');
  assert.equal(await board.locator('.adv-row').count(), rows, 'editing a row keeps the rows');
  for (const width of [390, 768, 1100]) {
    await page.setViewportSize({width, height: 900});
    const fit = await board.evaluate(n => { const box = n.shadowRoot.querySelector('.adv-box'), r = box.getBoundingClientRect(); return {right: r.right, width: innerWidth, overflow: [...box.querySelectorAll('select,input,button')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length, scroll: document.documentElement.scrollWidth}; });
    assert(fit.right <= fit.width + 1 && fit.overflow === 0 && fit.scroll <= fit.width + 1, 'Advanced conditions fit at ' + width + 'px: ' + JSON.stringify(fit));
  }
  await page.setViewportSize({width: 1100, height: 900});
  await detail.locator('[data-command=save]').dispatchEvent('click');
  await page.waitForFunction(() => !document.querySelector('deepal-companion-panel').localBoard.busy && !document.querySelector('deepal-companion-panel').localBoard.dirty);
  let saved = (await page.evaluate(() => window.localNotifications)).rules.find(r => r.preset === 'unlocked');
  assert.equal(saved.preset_options.adv.on, true); assert.equal(saved.preset_options.adv.mode, 'all');
  assert(saved.preset_options.adv.rows.some(r => r.s === 'odo' && r.v === 'still' && r.t === 30), 'the row is saved');
  assert(saved.condition.includes('total_odometer') && saved.condition.includes(' and '), 'all: rows are joined with and');
  assert(saved.checks.length >= 3 && saved.checks.every(c => c.help && c.help.length > 20), 'every check has an explanation');
  assert(saved.checks.some(c => c.label === 'All of your conditions are true'));
  await board.locator('[data-adv-act=remove]').last().click();
  assert.equal(await board.locator('.adv-row').count(), rows - 1, 'a row can be removed');
  await board.locator('[data-adv=on]').locator('..').click();
  assert.equal(await board.locator('.adv-row').count(), 0, 'switching off hides the rows');
  assert.equal(await board.locator('[data-condition=parked]').count(), 1, 'the parked switch is back');
  await detail.locator('[data-command=save]').dispatchEvent('click');
  await page.waitForFunction(() => !document.querySelector('deepal-companion-panel').localBoard.busy && !document.querySelector('deepal-companion-panel').localBoard.dirty);
  saved = (await page.evaluate(() => window.localNotifications)).rules.find(r => r.preset === 'unlocked');
  assert.notEqual(saved.preset_options.adv && saved.preset_options.adv.on, true); assert(saved.condition.includes('power_status') && saved.condition.includes('total_odometer'), 'the default parked check returns');
  /* 3. Why isn't it sending? and the ? explanations */
  await detail.getByText('Why isn’t it sending?').first().click();
  await board.locator('.design-why li').first().waitFor();
  assert.equal(await board.locator('.design-why li').count(), 3);
  assert.equal(await board.locator('.design-why-help').count(), 2, 'only lines with an explanation get a ?');
  await board.locator('.design-why-help').first().click();
  const dialog = await page.evaluate(() => { const d = document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.supplied-notification-design').shadowRoot.querySelector('.design-why-dialog'); return d && {open: d.open, text: d.textContent, label: d.getAttribute('aria-labelledby')}; });
  assert(dialog && dialog.open && dialog.text.includes('Help for the doors line.') && dialog.text.includes('Doors are unlocked'), 'the ? opens the explanation');
  for (const width of [390, 1100]) { await page.setViewportSize({width, height: 700}); const box = await page.evaluate(() => { const r = document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.supplied-notification-design').shadowRoot.querySelector('.design-why-dialog').getBoundingClientRect(); return {l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight}; }); assert(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b <= box.h, 'the explanation fits the screen at ' + width + 'px: ' + JSON.stringify(box)); }
  await page.setViewportSize({width: 1100, height: 900});
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.supplied-notification-design').shadowRoot.querySelector('.design-why-dialog')); /* Esc closes it */
  await board.locator('.design-why-help').nth(1).click(); await page.evaluate(() => [...document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.supplied-notification-design').shadowRoot.querySelectorAll('.design-why-dialog button')].find(b => b.textContent === 'Close').click());
  await page.waitForFunction(() => !document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.supplied-notification-design').shadowRoot.querySelector('.design-why-dialog')); /* the dialog removes itself when its close event fires */
  /* 4. Left open or unlocked (live): parked switch and the 5-minute wait */
  await board.locator('#main-card [data-design-click="switchView(\'overview\')"]').first().click();
  await board.locator('[data-live-open=open]').first().click();
  const live = await board.evaluate(n => { const r = n.shadowRoot, sw = r.querySelector('[data-live-switch=only_parked]'), wait = r.querySelector('[data-live-number=start_delay]'); return {text: sw && r.textContent.includes('Only when the car is parked') ? 'Only when the car is parked' : '', switchOn: sw && sw.checked, wait: wait && wait.value}; });
  assert(live.text && live.text.includes('Only when the car is parked'), 'live switch label: ' + live.text); assert.equal(live.switchOn, true, 'on by default'); assert.equal(live.wait, '5', 'Wait before showing defaults to 5 minutes');
  /* 5. the unread badge on the card */
  await page.evaluate(async () => {
    window.unread = 2; window.unreadCalls = [];
    const card = document.createElement('deepal-companion-card'); card.id = 'badge-card'; card.setConfig({type: 'custom:deepal-companion-card', vehicle_id: 'car', view_id: 'mobile'}); document.body.append(card); card.hass = window.testHass;
  });
  await page.waitForFunction(() => document.getElementById('badge-card')._nfUnread === 2);
  assert.equal(await page.evaluate(() => document.getElementById('badge-card')._el.nfbell.querySelector('.bdg')?.textContent), '2', 'two unread alerts');
  await page.evaluate(() => document.getElementById('badge-card')._el.nfbell.click());
  await page.waitForFunction(() => window.unreadCalls.some(c => c.mark === true));
  assert.equal(await page.evaluate(() => document.getElementById('badge-card')._el.nfbell.querySelector('.bdg')), null, 'opening the list clears the badge');
  await page.evaluate(() => { const card = document.getElementById('badge-card'); card._closeSheet(); window.unreadCalls = []; card._isCompanionPreview = true; card._nfUnread = 5; card._drawnReset = (card._el.nfbell._drawn = null); card._paintNotificationLink(); });
  assert.equal(await page.evaluate(() => document.getElementById('badge-card')._el.nfbell.querySelector('.bdg')), null, 'the preview never shows a number');
  await page.evaluate(() => { const card = document.getElementById('badge-card'); card._isCompanionPreview = false; card.remove(); });
  console.log('PASS: Advanced conditions (on/off, add/edit/remove, any/all, save), Why isn’t it sending with ? explanations, unread badge, preview, Greek and Spanish texts.');
};
