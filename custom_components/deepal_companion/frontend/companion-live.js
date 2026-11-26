/* Live notifications: rows in the same style as the other alerts (with a LIVE tag); in its own box; each opens its own page.
   Charging, climate and left-open/unlocked share this code; the saved settings live in the notification settings. */
const OPEN_ITEMS = ['front_left_door', 'front_right_door', 'rear_left_door', 'rear_right_door', 'front_left_window', 'front_right_window', 'rear_left_window', 'rear_right_window', 'hood', 'trunk'];
const LOOK = {title: '', icon: '', color: '', url: ''};

// Match the adjacent old-data control while keeping both selected text lines visible.
export async function alignNavigationField(picker){
  const visit=async(node,depth=0)=>{
    if(depth>10||!picker.isConnected)return;
    if(node.localName.includes("-"))await customElements.whenDefined(node.localName);
    await node.updateComplete;
    const root=node.shadowRoot;if(!root)return;
    if(!root.querySelector('[data-navigation-alignment]')){
      const style=document.createElement('style');style.dataset.navigationAlignment='';
      style.textContent='.field,.trigger,.mdc-text-field,.mdc-text-field__affix{align-items:center!important}.field,.mdc-text-field{box-sizing:border-box;height:var(--notification-navigation-height,60px)!important;min-height:var(--notification-navigation-height,60px)!important;max-height:none!important}.trigger{display:flex!important;align-items:center!important;height:100%!important;box-sizing:border-box}.content,.text{justify-content:center!important;min-width:0}.primary,.secondary{line-height:18px!important}.content{padding-top:0!important;padding-bottom:0!important}ha-combo-box-item{align-self:center;--ha-combo-box-item-min-height:var(--notification-navigation-height,60px);--ha-combo-box-item-two-line-min-height:var(--notification-navigation-height,60px)}ha-icon,ha-svg-icon,ha-icon-button,.clear-button,.toggle-button{align-self:center!important;margin-top:0!important;margin-bottom:0!important}.mdc-text-field__input{padding-top:0!important}';
      root.append(style);
    }
    await Promise.all([...root.querySelectorAll('*')].filter(child=>child.localName.includes('-')).map(child=>visit(child,depth+1)));
  };
  await visit(picker);
}
export const LIVE_DEFAULTS = {
  climate: {enabled: false, devices: [], min_interval: 120, max_age: 1800, start_delay: 0, end_delay: 30, parked_after: 360, temp_step: 1, ready_margin: 1, show_target: true, show_outside: false, show_progress: true, show_timer: true, show_updated: false, turn_off_button: true, max_run: 0, only_parked: true, ...LOOK},
  open: {enabled: false, devices: [], min_interval: 30, max_age: 3600, start_delay: 300, end_delay: 10, parked_after: 360, items: OPEN_ITEMS, include_unlocked: true, only_parked: true, lock_button: true, max_shown: 4, show_count: true, show_timer: true, show_updated: false, ...LOOK},
};
const GROUPS = {doors: OPEN_ITEMS.slice(0, 4), windows: OPEN_ITEMS.slice(4, 8), hood: ['hood'], trunk: ['trunk']};
// Each page is built from titled sections. A row names its section ('watch', 'show' or 'timing'): switches become option tiles, numbers become stepper cards.
const SECTIONS = {
  watch: ['mdi:eye-outline', 'What to watch', 'Choose what triggers the notification'],
  show: ['mdi:tune-variant', 'Notification components', 'Choose what appears on the Lock Screen card'],
  timing: ['mdi:clock-fast', 'Timing & limits', 'Save battery and skip brief triggers'],
};
const sw = (key, label, desc, badge, s = 'show') => ({kind: 'switch', key, label, desc, badge, s});
const grp = (key, label, desc) => ({kind: 'group', key, label, desc, s: 'watch'});
const num = (key, label, desc, unit, scale, low, high) => ({kind: 'number', key, label, desc, unit, scale, low, high, s: 'timing'});
const KINDS = {
  charging: {name: 'Live charging', icon: 'mdi:lightning-bolt-circle', sub: 'Battery and time left while charging', info: 'Shows the battery level and time left on the Lock Screen while the car charges.',
    presets: ['mdi:lightning-bolt-circle', 'mdi:ev-station', 'mdi:battery-charging', 'mdi:power-plug'],
    rows: [sw('show_timer', 'Show time remaining', 'Time left until the charge finishes'), num('min_interval', 'Update at most every', 'Shortest time between Lock Screen updates', 'min', 60, 1, 60), num('battery_step', 'Update every', 'Refresh when the battery changes by this much', '%', 1, 1, 20)]},
  climate: {name: 'Live climate', icon: 'mdi:fan', sub: 'Cabin temperature while the climate is on', info: 'Shown while the climate is on, with the cabin temperature against the target.',
    presets: ['mdi:fan', 'mdi:air-conditioner', 'mdi:thermometer-lines', 'mdi:snowflake'],
    rows: [sw('only_parked', 'Only when the car is parked', 'Nothing while driving', null, 'watch'), sw('show_target', 'Show target temperature', 'The temperature the climate is heading to'), sw('show_outside', 'Show outside temperature', 'Outdoor reading next to the cabin value'), sw('show_progress', 'Show progress bar', 'How close the cabin is to the target'), sw('show_timer', 'Show running time', 'How long the climate has been on'),
      sw('turn_off_button', '“Turn off” button', 'Stop the climate from the notification', 'Android only'), num('min_interval', 'Update at most every', 'Shortest time between Lock Screen updates', 'min', 60, 1, 60),
      num('parked_after', 'Count as parked after', 'Time stopped before the car counts as parked', 'min', 60, 1, 60), num('start_delay', 'Wait before showing', 'Skip short runs by waiting first', 'min', 60, 0, 10)]},
  open: {name: 'Left open or unlocked', icon: 'mdi:car-door-lock-open', sub: 'Open doors, windows and an unlocked car', info: 'One notification lists what is open or unlocked. Items drop off as they close; it disappears when all is secure.',
    presets: ['mdi:car-door-lock-open', 'mdi:lock-open-variant-outline', 'mdi:window-open', 'mdi:shield-lock'],
    rows: [grp('doors', 'Doors', 'All four doors'), grp('windows', 'Windows', 'All four windows'), grp('hood', 'Bonnet', 'The front bonnet'), grp('trunk', 'Trunk', 'The rear trunk'), sw('include_unlocked', 'Unlocked car', 'Also alert when the car is unlocked', null, 'watch'), sw('only_parked', 'Only when the car is parked', 'Nothing while driving', null, 'watch'),
      sw('show_count', 'Show item count', 'How many items are open'), sw('show_timer', 'Show time open', 'How long something has been open'), sw('lock_button', '“Lock vehicle” button', 'Lock the car from the notification', 'Android only'),
      num('parked_after', 'Count as parked after', 'Time stopped before the car counts as parked', 'min', 60, 1, 60), num('start_delay', 'Wait before showing', 'Time to close things before the alert', 'min', 60, 0, 60)]},
};
// Phones only show Material Design icons, so the choices are mdi: names (others are refused).
const ICONS = ['mdi:lightning-bolt-circle', 'mdi:ev-station', 'mdi:battery-charging', 'mdi:battery-charging-high', 'mdi:battery-charging-medium', 'mdi:battery-charging-low', 'mdi:battery-high', 'mdi:battery-alert', 'mdi:flash', 'mdi:flash-outline', 'mdi:lightning-bolt', 'mdi:power-plug', 'mdi:power-plug-outline', 'mdi:ev-plug-type2', 'mdi:fan', 'mdi:air-conditioner', 'mdi:thermometer', 'mdi:thermometer-lines', 'mdi:snowflake', 'mdi:weather-sunny', 'mdi:sun-thermometer', 'mdi:radiator', 'mdi:hvac', 'mdi:car', 'mdi:car-electric', 'mdi:car-side', 'mdi:car-door', 'mdi:car-door-lock', 'mdi:car-door-lock-open', 'mdi:car-key', 'mdi:car-off', 'mdi:car-battery', 'mdi:car-seat-heater', 'mdi:car-seat-cooler', 'mdi:car-emergency', 'mdi:lock', 'mdi:lock-open', 'mdi:lock-open-variant-outline', 'mdi:lock-alert', 'mdi:shield-car', 'mdi:shield-lock', 'mdi:garage-open', 'mdi:window-open', 'mdi:window-closed', 'mdi:alert', 'mdi:alert-circle', 'mdi:bell', 'mdi:bell-ring', 'mdi:information', 'mdi:check-circle', 'mdi:timer-outline', 'mdi:clock-outline', 'mdi:gauge', 'mdi:speedometer', 'mdi:engine', 'mdi:steering', 'mdi:wiper', 'mdi:car-wireless', 'mdi:broadcast', 'mdi:fire'];
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

const T = (text, ...a) => { const u = window.__DEEPAL_COMPANION_UI; return u && u.t ? u.t(text, ...a) : a.reduce((r, v, i) => r.replace('{' + i + '}', v), text); };
export function mountLive({q, getState, getUrl, setUrl, getDevices, getHass, request, toast, changed, setInvalid, busy, response}) {
  const template = q('.alert-row'), firstGrid = template.parentElement, firstCategory = firstGrid.parentElement, overview = q('#view-overview');
  let syncCardTap = () => {};
  const supported = response.live_supported === true, active = {charging: !!response.live_test_active, ...response.live_status_test_active};
  // The LIVE tag is yellow while a notification is on and grey while it is off.
  const tags = [];
  const tag = (id) => { const node = el('span', 'live-tag', T('LIVE')); node.dataset.liveTag = id || ''; tags.push(node); return node; };
  const clean = (root) => { for (const node of [root, ...root.querySelectorAll('*')]) for (const name of ['onclick', 'onchange', 'oninput', 'data-design-click', 'data-alert-open', 'data-alert-id', 'data-alert-toggle']) node.removeAttribute(name); return root; };
  const icon = (name) => { const node = document.createElement('ha-icon'); node.setAttribute('icon', name); return node; };
  const TILE_ICONS = {doors: 'mdi:car-door', windows: 'mdi:car-windshield-outline', hood: 'mdi:car-select', trunk: 'mdi:car-back', include_unlocked: 'mdi:lock-open-variant-outline', only_parked: 'mdi:parking', show_count: 'mdi:counter', show_timer: 'mdi:timer-outline', lock_button: 'mdi:lock-outline', show_target: 'mdi:target', show_outside: 'mdi:weather-partly-cloudy', show_progress: 'mdi:progress-check', turn_off_button: 'mdi:power'};
  const toggle = (data) => { const label = clean(q('#master-toggle').closest('label').cloneNode(true)), input = label.querySelector('input'); input.removeAttribute('id'); input.checked = false; Object.assign(input.dataset, data); return label; };
  // Overview: its own box at the top, separate from the other alerts, with one row per live notification.
  const alerts = firstCategory.closest('.ha-card') || firstCategory, box = alerts.cloneNode(false), category = firstCategory.cloneNode(false), heading = firstCategory.firstElementChild.cloneNode(false), grid = firstGrid.cloneNode(false);
  heading.append(icon('mdi:broadcast'), document.createTextNode(' Live notifications'), tag()); category.append(heading, grid); box.append(category); alerts.before(box);
  const stepRow = q('#input-delay').closest('.flex.items-center.justify-between'), pages = {}, rows = {};
  const group = (cfg, id) => GROUPS[id].every((item) => cfg.items.includes(item));
  const summary = (id, cfg) => (cfg.enabled ? 'On · ' : 'Off · ') + KINDS[id].sub;
  // Building blocks for the live pages; every look comes from notification-layout.js (no inline styling).
  const head = (iconName, title, sub, extra) => { const box = el('div', 'live-head'), text = el('div', 'live-ht'), mark = icon(iconName); mark.classList.add('live-hi'); text.append(el('h3', '', T(title)), el('p', '', T(sub))); box.append(mark, text); if (extra) box.append(extra); return box; };
  const caption = (row) => { const text = el('span', 'live-tx'), title = el('span', 'live-tt', T(row.label)); if (row.badge) title.append(el('span', 'live-badge', T(row.badge))); text.append(title, el('small', 'live-td', T(row.desc))); return text; };
  // A switch as a tile: tap anywhere; the real checkbox stays (hidden) for the keyboard and for saving.
  const tile = (row) => {
    const item = el('div', 'live-tile'), holder = el('div', 'live-sw'), mark = icon(TILE_ICONS[row.key] || 'mdi:toggle-switch-outline');
    mark.classList.add('live-ic'); mark.setAttribute('aria-hidden', 'true'); item.setAttribute('role', 'presentation');
    holder.append(toggle(row.kind === 'group' ? {liveGroup: row.key} : {liveSwitch: row.key}));
    item.append(mark, caption(row), holder, el('i', 'live-tk'));
    item.addEventListener('click', (event) => { if (event.target.closest('label')) return; const input = item.querySelector('input'); if (input && !input.disabled) input.click(); });
    return item;
  };
  // A number as a card: title and hint above, the same − value + pill as the alert pages below.
  const stepper = (row) => {
    const item = clean(stepRow.cloneNode(true)), holder = item.lastElementChild;
    item.removeAttribute('data-parameter'); for (const node of item.querySelectorAll('[id]')) node.removeAttribute('id');
    item.querySelector('span').replaceWith(caption(row)); item.classList.add('compact-control-row', 'live-stepper');
    const input = item.querySelector('input'); Object.assign(input, {min: row.low, max: row.high, required: true}); input.dataset.liveNumber = row.key; input.dataset.scale = row.scale; input.nextElementSibling.textContent = row.unit;
    const [minus, plus] = holder.querySelectorAll('button'); minus.dataset.liveStep = '-1'; plus.dataset.liveStep = '1'; minus.type = plus.type = 'button';
    return item;
  };
  const build = (id) => {
    const spec = KINDS[id], row = clean(template.cloneNode(true));
    for (const node of [row.querySelector('div.cursor-pointer'), row.querySelector('button')]) node.dataset.liveOpen = id;
    row.querySelector('input').dataset.liveToggle = id;
    row.querySelector('.design-event-icon ha-icon').setAttribute('icon', spec.icon); row.querySelector('h4').textContent = spec.name; row.querySelector('h4').append(tag(id));
    grid.append(row); rows[id] = row;
    // Page: same header and boxes as the alert pages.
    const header = clean(q('#main-card').firstElementChild.cloneNode(true)); for (const node of header.querySelectorAll('[id]')) node.removeAttribute('id');
    const [left, right] = header.children, [back, iconBox, text] = left.children;
    back.dataset.liveBack = ''; iconBox.replaceChildren(icon(spec.icon)); text.firstElementChild.firstElementChild.textContent = spec.name; text.firstElementChild.firstElementChild.append(tag(id));
    text.firstElementChild.children[1]?.remove(); const status = text.querySelector('p'); status.children[1].textContent = 'Live notification'; status.children[2].textContent = '• Lock Screen';
    const power = right.querySelector('input'), pill = power.closest('label').parentElement; pill.classList.add('design-alert-switch'); pill.querySelector('span').textContent = 'Alert enabled'; power.dataset.liveToggle = id; right.querySelectorAll('button').forEach((button) => button.remove());
    const body = el('div', 'p-4 space-y-4'), info = el('aside', 'notification-info live-info'), infoText = el('div'); info.setAttribute('role', 'note');
    infoText.append(el('p', '', spec.info), el('p', '', supported ? 'Needs iOS 17.2+ or Android 16+ with Live Activities / Live Updates enabled in the Companion app.' : T('Needs Home Assistant 2026.7 or newer and a restart of Home Assistant.')));
    info.append(icon('mdi:information-outline'), infoText);
    const sections = ['watch', 'show', 'timing'].filter((name) => spec.rows.some((row) => row.s === name)).map((name) => {
      const [sectionIcon, title, sub] = SECTIONS[name], rowsHere = spec.rows.filter((row) => row.s === name), tiles = rowsHere.some((row) => row.kind !== 'number');
      const box = el('section', 'ha-inner-box live-section'), grid = el('div', tiles ? 'live-grid' : 'live-grid live-steppers'), count = tiles && rowsHere.length > 1 ? el('span', 'live-count') : null;
      box.dataset.liveSection = name; if (count) count.dataset.liveCount = name;
      box.append(head(sectionIcon, title, sub, count), grid);
      for (const row of rowsHere) grid.append(row.kind === 'number' ? stepper(row) : tile(row));
      return box;
    });
    const look = el('section', 'ha-inner-box live-section'), picker = document.createElement('ha-selector'), preview = el('span', 'live-prev'), previewIcon = icon(spec.icon), field = el('div', 'live-iconrow'), presets = el('div', 'live-presets');
    picker.className = 'design-icon-picker'; picker.hass = getHass(); picker.selector = {select: {options: ICONS, custom_value: true, mode: 'dropdown'}}; picker.label = ''; picker.required = false; picker.setAttribute('aria-label', T('Notification icon'));
    preview.append(previewIcon); field.append(preview, picker); presets.append(el('span', 'live-presets-l', T('Quick presets')));
    for (const name of spec.presets) { const chip = el('button', 'live-chip'); chip.type = 'button'; chip.dataset.livePreset = name; chip.setAttribute('aria-pressed', 'false'); chip.append(icon(name), document.createTextNode(name.slice(4))); presets.append(chip); }
    look.append(head('mdi:palette-swatch-outline', 'Notification icon', 'Any Material Design icon (mdi:) works on your phone'), field, presets);
    const actions = el('section', 'ha-inner-box live-section'), bar = el('div', 'live-actions'), test = el('button', 'live-btn live-btn-primary'), end = el('button', 'live-btn'), feedback = el('p', 'design-test-feedback ha-inner-box p-3'); feedback.hidden = true;
    for (const [button, mark, caption2, stop] of [[test, 'mdi:send-check', 'Send test', false], [end, 'mdi:stop-circle-outline', 'End test', true]]) { button.type = 'button'; button.dataset.liveTest = stop ? 'stop' : 'start'; button.append(icon(mark), document.createTextNode(T(caption2))); bar.append(button); }
    actions.append(head('mdi:cellphone-message', 'Try it on your phone', 'Sends a sample now. Your real notification stays unchanged.'), bar, feedback);
    body.append(info, ...sections, look, actions);
    const shell = q('#main-card').cloneNode(false); shell.removeAttribute('id'); shell.append(header, body);
    const wrap = el('div', 'space-y-3'); wrap.hidden = true; wrap.dataset.livePage = id; wrap.append(shell); overview.after(wrap); pages[id] = {wrap, power, picker, test, end, feedback, preview: previewIcon, chips: [...presets.querySelectorAll('button')]};
  };
  for (const id of Object.keys(KINDS)) build(id);
  let current = '';
  const show = (id) => { current = id; overview.classList.toggle('hidden', !!id); for (const [key, page] of Object.entries(pages)) page.wrap.hidden = key !== id; if (id) { pages[id].wrap.scrollIntoView?.({block: 'start'}); pages[id].picker.style.setProperty('--notification-navigation-height', '44px'); alignNavigationField(pages[id].picker); } };
  const syncLook = (id) => { const page = pages[id], shown = getState()[id].icon || KINDS[id].icon; page.preview.setAttribute('icon', shown); for (const chip of page.chips) chip.setAttribute('aria-pressed', String(chip.dataset.livePreset === shown)); };
  const setIcon = (id, value) => { getState()[id].icon = value === KINDS[id].icon ? '' : value || ''; pages[id].picker.value = value || KINDS[id].icon; syncLook(id); changed(); };
  const refresh = () => {
    const state = getState();
    for (const [id, page] of Object.entries(pages)) {
      const cfg = state[id], toggleInput = rows[id].querySelector('[data-live-toggle]');
      toggleInput.checked = page.power.checked = !!cfg.enabled; rows[id].dataset.enabled=String(!!cfg.enabled); rows[id].querySelector('p').textContent = summary(id, cfg);
      for (const input of page.wrap.querySelectorAll('[data-live-switch]')) input.checked = !!cfg[input.dataset.liveSwitch];
      for (const input of page.wrap.querySelectorAll('[data-live-group]')) input.checked = group(cfg, input.dataset.liveGroup);
      for (const input of page.wrap.querySelectorAll('[data-live-number]')) input.value = Math.round(cfg[input.dataset.liveNumber] / Number(input.dataset.scale));
      const shown = cfg.icon || KINDS[id].icon; if ((page.picker.value || '') !== shown) page.picker.value = shown; syncLook(id);
      for (const badge of page.wrap.querySelectorAll('[data-live-count]')) { const boxes = [...badge.closest('[data-live-section]').querySelectorAll('input[type=checkbox]')]; badge.textContent = T('{0} of {1} active', boxes.filter((box) => box.checked).length, boxes.length); }
      page.test.disabled = !!busy() || !supported; page.end.disabled = !!busy() || !supported || !active[id];
    }
    for (const node of tags) { const on = node.dataset.liveTag ? state[node.dataset.liveTag].enabled : Object.keys(KINDS).some((id) => state[id].enabled), tone = on ? '--design-warn' : '--design-muted'; node.style.background = `rgb(var(${tone})/.15)`; node.style.color = `rgb(var(${tone}))`; }
    tapPicker.value = getUrl() || '';
    requestAnimationFrame(()=>{const reference=q('#input-fresh')?.closest('.compact-control-row, .flex.items-center.justify-between');const height=reference?.getBoundingClientRect().height;if(height>0)tapPicker.style.setProperty('--notification-navigation-height',height+'px');alignNavigationField(tapPicker);});
    syncCardTap();
  };
  const run = async (id, stop) => {
    if (busy()) return; setInvalid(); busy(true); const page = pages[id], cfg = getState()[id];
    try {
      const result = await request(id === 'charging' ? (stop ? 'notifications_live_stop_test' : 'notifications_live_test') : (stop ? 'notifications_live_status_stop_test' : 'notifications_live_status_test'),
        {...(id === 'charging' ? {} : {kind: id}), value: {...cfg, enabled: false, devices: getDevices(), url: getUrl() || ''}});
      const sent = result.deliveries || [], failures = sent.filter((row) => row.status === 'error');
      if (stop && !failures.length) active[id] = false; else if (!stop && sent.some((row) => row.status === 'accepted')) active[id] = true;
      page.feedback.hidden = false; page.feedback.dataset.kind = failures.length ? 'error' : 'success';
      page.feedback.textContent = failures.length ? failures.map((row) => row.error).join('; ') : stop ? (sent.length ? T('Test ended. Your real notification is unchanged.') : T('No test is running.')) : T('Test sent to {0} device(s). Phone delivery is not confirmed.', sent.length);
      toast(failures.length ? 'Test could not be delivered.' : stop ? 'Test ended.' : 'Test sent. Check your phone.', !!failures.length);
    } catch (error) { page.feedback.hidden = false; page.feedback.dataset.kind = 'error'; page.feedback.textContent = window.__DEEPAL_COMPANION_UI.tError(error.message) || String(error); toast(page.feedback.textContent, true); } finally { busy(false); refresh(); }
  };
  // Where the phone opens when a notification is tapped: next to "Old data protection", in the same box.
  const tapPicker = document.createElement('ha-selector'), tapPanel = el('div', 'space-y-3');
  tapPicker.hass = getHass(); tapPicker.selector = {navigation: {}}; tapPicker.label = ''; tapPicker.required = false; tapPicker.className = 'design-navigation-picker'; tapPicker.style.cssText='display:block;width:100%;min-width:0;height:var(--notification-navigation-height,60px);min-height:var(--notification-navigation-height,60px);--ha-select-height:var(--notification-navigation-height,60px);--ha-color-form-background:var(--design-inner)';
  tapPicker.addEventListener('value-changed', (event) => { event.stopPropagation(); if (busy() || typeof event.detail?.value !== 'string' && event.detail?.value != null) return; setUrl(event.detail.value || ''); changed(); });
  tapPanel.append(el('div', 'font-bold text-[11px] text-gray-300', 'When you tap a notification'), el('p', 'text-[11px] text-gray-400 leading-relaxed', 'The dashboard page opened when you tap a notification. Empty opens the app’s default page.'), tapPicker);
  // The page that shows only the card: one button to choose it as the tap target.
  const CARD_PAGE = '/deepal-companion-card';
  const cardTap = el('button', 'px-3.5 py-1.5 rounded-full text-[11px] border');
  cardTap.type = 'button'; cardTap.dataset.liveCardTap = ''; cardTap.textContent = 'Card only page';
  syncCardTap = () => {
    const on = (getUrl() || '') === CARD_PAGE;
    cardTap.className = 'px-3.5 py-1.5 rounded-full text-[11px] border ' + (on ? 'bg-emerald-400 text-slate-950 font-bold border-transparent' : 'bg-[#151619] border-[#282a30] text-gray-300');
    cardTap.setAttribute('aria-pressed', on ? 'true' : 'false'); cardTap.disabled = !!busy();
  };
  cardTap.addEventListener('click', () => { if (busy()) return; const on = (getUrl() || '') === CARD_PAGE; setUrl(on ? '' : CARD_PAGE); tapPicker.value = on ? '' : CARD_PAGE; syncCardTap(); changed(); });
  tapPicker.addEventListener('value-changed', () => {queueMicrotask(syncCardTap);requestAnimationFrame(()=>alignNavigationField(tapPicker));});
  tapPanel.append(cardTap); syncCardTap();
  const old = q('#input-fresh')?.closest('.ha-card');
  if (old) { const first = el('div', 'space-y-3'); first.append(...old.childNodes); old.classList.remove('space-y-3'); old.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:start'; old.append(first, tapPanel); }
  else { const card = el('section', 'ha-card p-4'); card.append(tapPanel); overview.append(card); }
  const root = overview.getRootNode();
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest?.('[data-design-click],[data-live-back]')) { if (current) show(''); return; }
    if (busy()) return;
    const step = target.closest?.('[data-live-step]'); if (step) { const input = step.parentElement.querySelector('input'); input.value = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value) + Number(step.dataset.liveStep))); input.dispatchEvent(new Event('input', {bubbles: true})); return; }
    const preset = target.closest?.('[data-live-preset]'); if (preset) { setIcon(preset.closest('[data-live-page]').dataset.livePage, preset.dataset.livePreset); return; }
    const open = target.closest?.('[data-live-open]'); if (open) { show(open.dataset.liveOpen); return; }
    const test = target.closest?.('[data-live-test]'); if (test) run(test.closest('[data-live-page]').dataset.livePage, test.dataset.liveTest === 'stop');
  }, true);
  root.addEventListener('change', (event) => {
    if (busy()) return; const target = event.target, id = target.closest?.('[data-live-page]')?.dataset.livePage || target.dataset.liveToggle, cfg = id && getState()[id];
    if (!cfg || target.type !== 'checkbox') return; event.stopPropagation();
    if ('liveToggle' in target.dataset) cfg.enabled = target.checked;
    else if ('liveSwitch' in target.dataset) cfg[target.dataset.liveSwitch] = target.checked;
    else if ('liveGroup' in target.dataset) { const set = new Set(cfg.items); for (const item of GROUPS[target.dataset.liveGroup]) target.checked ? set.add(item) : set.delete(item); cfg.items = OPEN_ITEMS.filter((item) => set.has(item)); }
    else return;
    changed(); refresh();
  }, true);
  root.addEventListener('input', (event) => {
    const target = event.target, id = target.closest?.('[data-live-page]')?.dataset.livePage; if (!id || busy() || !('liveNumber' in target.dataset)) return; const cfg = getState()[id];
    if (!target.checkValidity()) target.setAttribute('aria-invalid', 'true'); else { target.removeAttribute('aria-invalid'); cfg[target.dataset.liveNumber] = Number(target.value) * Number(target.dataset.scale); } setInvalid(); changed();
  }, true);
  for (const [id, page] of Object.entries(pages)) page.picker.addEventListener('value-changed', (event) => {
    event.stopPropagation(); if (busy()) { refresh(); return; } const value = event.detail?.value; if (typeof value !== 'string' && value != null) return;
    if (value && !value.startsWith('mdi:')) { toast('Phones only show mdi: icons. Pick an mdi: icon.', true); page.picker.value = getState()[id].icon || KINDS[id].icon; return; }
    getState()[id].icon = value === KINDS[id].icon ? '' : value || ''; syncLook(id); changed();
  });
  refresh();
  return {refresh};
}
