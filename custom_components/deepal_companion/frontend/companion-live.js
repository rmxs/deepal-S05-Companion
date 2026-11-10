/* Live notifications: rows in the same style as the other alerts (with a LIVE tag); in its own box; each opens its own page.
   Charging, climate and left-open/unlocked share this code; the saved settings live in the notification settings. */
const OPEN_ITEMS = ['front_left_door', 'front_right_door', 'rear_left_door', 'rear_right_door', 'front_left_window', 'front_right_window', 'rear_left_window', 'rear_right_window', 'hood', 'trunk'];
const LOOK = {title: '', icon: '', color: '', url: ''};
export const LIVE_DEFAULTS = {
  climate: {enabled: false, devices: [], min_interval: 120, max_age: 1800, start_delay: 0, end_delay: 30, temp_step: 1, ready_margin: 1, show_target: true, show_outside: false, show_progress: true, show_timer: true, show_updated: false, turn_off_button: true, max_run: 0, ...LOOK},
  open: {enabled: false, devices: [], min_interval: 30, max_age: 3600, start_delay: 60, end_delay: 10, items: OPEN_ITEMS, include_unlocked: true, only_parked: true, lock_button: true, max_shown: 4, show_count: true, show_timer: true, show_updated: false, ...LOOK},
};
const GROUPS = {doors: OPEN_ITEMS.slice(0, 4), windows: OPEN_ITEMS.slice(4, 8), hood: ['hood'], trunk: ['trunk']};
const KINDS = {
  charging: {name: 'Live charging', icon: 'mdi:ev-station', sub: 'Battery and time left while charging', info: 'Shows the battery level and time left on the Lock Screen while the car charges.',
    rows: [['switch', 'show_timer', 'Show time remaining'], ['number', 'min_interval', 'Update at most every', 'min', 60, 1, 60], ['number', 'battery_step', 'Update every', '%', 1, 1, 20]]},
  climate: {name: 'Live climate', icon: 'mdi:fan', sub: 'Cabin temperature while the climate is on', info: 'Appears when the climate turns on and shows the cabin temperature against the target. It disappears when the climate stops.',
    rows: [['switch', 'show_target', 'Show target temperature'], ['switch', 'show_outside', 'Show outside temperature'], ['switch', 'show_progress', 'Show progress bar'], ['switch', 'show_timer', 'Show running time'],
      ['switch', 'turn_off_button', '“Turn off” button', 'Android only'], ['number', 'min_interval', 'Update at most every', 'min', 60, 1, 60], ['number', 'start_delay', 'Wait before showing', 'min', 60, 0, 10]]},
  open: {name: 'Left open or unlocked', icon: 'mdi:car-door-lock-open', sub: 'Open doors, windows and an unlocked car', info: 'One notification lists what is open or unlocked. Items drop off as they are closed, and it disappears when everything is secure.',
    rows: [['group', 'doors', 'Doors'], ['group', 'windows', 'Windows'], ['group', 'hood', 'Bonnet'], ['group', 'trunk', 'Trunk'], ['switch', 'include_unlocked', 'Unlocked car'], ['switch', 'only_parked', 'Only when the car is off', 'Nothing while driving'], ['switch', 'show_count', 'Show item count'], ['switch', 'show_timer', 'Show time open'],
      ['switch', 'lock_button', '“Lock vehicle” button', 'Android only'], ['number', 'start_delay', 'Wait before showing', 'min', 60, 0, 60]]},
};
// Phones only show Material Design icons, so the choices are mdi: names (others are refused).
const ICONS = ['mdi:ev-station', 'mdi:battery-charging', 'mdi:battery-charging-high', 'mdi:battery-charging-medium', 'mdi:battery-charging-low', 'mdi:battery-high', 'mdi:battery-alert', 'mdi:flash', 'mdi:flash-outline', 'mdi:lightning-bolt', 'mdi:power-plug', 'mdi:power-plug-outline', 'mdi:ev-plug-type2', 'mdi:fan', 'mdi:air-conditioner', 'mdi:thermometer', 'mdi:thermometer-lines', 'mdi:snowflake', 'mdi:weather-sunny', 'mdi:sun-thermometer', 'mdi:radiator', 'mdi:hvac', 'mdi:car', 'mdi:car-electric', 'mdi:car-side', 'mdi:car-door', 'mdi:car-door-lock', 'mdi:car-door-lock-open', 'mdi:car-key', 'mdi:car-off', 'mdi:car-battery', 'mdi:car-seat-heater', 'mdi:car-seat-cooler', 'mdi:car-emergency', 'mdi:lock', 'mdi:lock-open', 'mdi:lock-open-variant-outline', 'mdi:lock-alert', 'mdi:shield-car', 'mdi:shield-lock', 'mdi:garage-open', 'mdi:window-open', 'mdi:window-closed', 'mdi:alert', 'mdi:alert-circle', 'mdi:bell', 'mdi:bell-ring', 'mdi:information', 'mdi:check-circle', 'mdi:timer-outline', 'mdi:clock-outline', 'mdi:gauge', 'mdi:speedometer', 'mdi:engine', 'mdi:steering', 'mdi:wiper', 'mdi:car-wireless', 'mdi:broadcast', 'mdi:fire'];
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

export function mountLive({q, getState, getUrl, setUrl, getDevices, getHass, request, toast, changed, setInvalid, busy, response}) {
  const template = q('.alert-row'), firstGrid = template.parentElement, firstCategory = firstGrid.parentElement, overview = q('#view-overview');
  const supported = response.live_supported === true, active = {charging: !!response.live_test_active, ...response.live_status_test_active};
  // The LIVE tag is yellow while a notification is on and grey while it is off.
  const tags = [];
  const tag = (id) => { const node = el('span', '', 'LIVE'); node.dataset.liveTag = id || ''; node.style.cssText = 'margin-left:8px;font-size:9px;font-weight:700;letter-spacing:.06em;padding:1px 6px;border-radius:999px;vertical-align:middle'; tags.push(node); return node; };
  const clean = (root) => { for (const node of [root, ...root.querySelectorAll('*')]) for (const name of ['onclick', 'onchange', 'oninput', 'data-design-click', 'data-alert-open', 'data-alert-id', 'data-alert-toggle']) node.removeAttribute(name); return root; };
  const icon = (name) => { const node = document.createElement('ha-icon'); node.setAttribute('icon', name); return node; };
  const toggle = (data) => { const label = clean(q('#master-toggle').closest('label').cloneNode(true)), input = label.querySelector('input'); input.removeAttribute('id'); input.checked = false; Object.assign(input.dataset, data); return label; };
  // Overview: its own box at the top, separate from the other alerts, with one row per live notification.
  const alerts = firstCategory.closest('.ha-card') || firstCategory, box = alerts.cloneNode(false), category = firstCategory.cloneNode(false), heading = firstCategory.firstElementChild.cloneNode(false), grid = firstGrid.cloneNode(false);
  heading.append(icon('mdi:broadcast'), document.createTextNode(' Live notifications'), tag()); category.append(heading, grid); box.append(category); alerts.before(box);
  const stepRow = q('#input-delay').closest('.flex.items-center.justify-between'), pages = {}, rows = {};
  const group = (cfg, id) => GROUPS[id].every((item) => cfg.items.includes(item));
  const summary = (id, cfg) => (cfg.enabled ? 'On · ' : 'Off · ') + KINDS[id].sub;
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
    const body = el('div', 'p-4 space-y-4'), info = el('aside', 'notification-info'), infoText = el('div'); info.setAttribute('role', 'note');
    infoText.append(el('p', '', spec.info), el('p', '', supported ? 'Needs iOS 17.2+ or Android 16+ with Live Activities / Live Updates enabled in the Companion app.' : 'Needs Home Assistant 2026.7 or newer and a restart of Home Assistant.'));
    info.append(icon('mdi:information-outline'), infoText);
    // Rows are copies of the alert pages' own rows (label left, switch or stepper right), three to a line.
    const options = el('div', 'ha-inner-box p-3.5'); options.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(max(220px,30%),1fr));gap:8px';
    for (const [kind, key, label, extra, scale, low, high] of spec.rows) {
      const item = clean(stepRow.cloneNode(true)), words = item.querySelector('span'), holder = item.lastElementChild;
      item.removeAttribute('data-parameter'); for (const node of item.querySelectorAll('[id]')) node.removeAttribute('id'); words.textContent = label;
      if (kind === 'number') {
        const input = item.querySelector('input'); Object.assign(input, {min: low, max: high, required: true}); input.dataset.liveNumber = key; input.dataset.scale = scale; input.nextElementSibling.textContent = extra;
        const [minus, plus] = holder.querySelectorAll('button'); minus.dataset.liveStep = '-1'; plus.dataset.liveStep = '1'; minus.type = plus.type = 'button';
      } else {
        if (extra) { const chip = el('span', 'text-[9px] font-semibold', extra); chip.style.cssText = 'margin-left:8px;color:rgb(var(--design-warn));background:rgb(var(--design-warn)/.12);border-radius:999px;padding:1px 6px;white-space:nowrap'; words.append(chip); }
        holder.replaceChildren(toggle(kind === 'group' ? {liveGroup: key} : {liveSwitch: key}));
      }
      options.append(item);
    }
    const look = el('div', 'ha-inner-box p-3.5'), picker = document.createElement('ha-selector'); picker.className = 'design-icon-picker'; picker.hass = getHass(); picker.selector = {select: {options: ICONS, custom_value: true, mode: 'dropdown'}}; picker.label = ''; picker.required = false;
    const field = el('label', 'block text-[11px] text-gray-300 space-y-1'); field.append(document.createTextNode('Icon (mdi: only)'), picker); look.append(field);
    const actions = el('div', 'flex flex-wrap gap-2'), test = q('[data-command=test]').cloneNode(true), end = q('[data-command=test]').cloneNode(true), feedback = el('p', 'design-test-feedback ha-inner-box p-3'); feedback.hidden = true;
    for (const [button, label, stop] of [[test, 'Send test', false], [end, 'End test', true]]) { delete button.dataset.command; button.textContent = label; button.dataset.liveTest = stop ? 'stop' : 'start'; button.type = 'button'; actions.append(button); }
    body.append(info, options, look, actions, feedback);
    const shell = q('#main-card').cloneNode(false); shell.removeAttribute('id'); shell.append(header, body);
    const wrap = el('div', 'space-y-3'); wrap.hidden = true; wrap.dataset.livePage = id; wrap.append(shell); overview.after(wrap); pages[id] = {wrap, power, picker, test, end, feedback};
  };
  for (const id of Object.keys(KINDS)) build(id);
  let current = '';
  const show = (id) => { current = id; overview.classList.toggle('hidden', !!id); for (const [key, page] of Object.entries(pages)) page.wrap.hidden = key !== id; if (id) pages[id].wrap.scrollIntoView?.({block: 'start'}); };
  const refresh = () => {
    const state = getState();
    for (const [id, page] of Object.entries(pages)) {
      const cfg = state[id], toggleInput = rows[id].querySelector('[data-live-toggle]');
      toggleInput.checked = page.power.checked = !!cfg.enabled; rows[id].querySelector('p').textContent = summary(id, cfg);
      for (const input of page.wrap.querySelectorAll('[data-live-switch]')) input.checked = !!cfg[input.dataset.liveSwitch];
      for (const input of page.wrap.querySelectorAll('[data-live-group]')) input.checked = group(cfg, input.dataset.liveGroup);
      for (const input of page.wrap.querySelectorAll('[data-live-number]')) input.value = Math.round(cfg[input.dataset.liveNumber] / Number(input.dataset.scale));
      const shown = cfg.icon || KINDS[id].icon; if ((page.picker.value || '') !== shown) page.picker.value = shown;
      page.test.disabled = !!busy() || !supported; page.end.disabled = !!busy() || !supported || !active[id];
    }
    for (const node of tags) { const on = node.dataset.liveTag ? state[node.dataset.liveTag].enabled : Object.keys(KINDS).some((id) => state[id].enabled), tone = on ? '--design-warn' : '--design-muted'; node.style.background = `rgb(var(${tone})/.15)`; node.style.color = `rgb(var(${tone}))`; }
    tapPicker.value = getUrl() || '';
  };
  const run = async (id, stop) => {
    if (busy()) return; setInvalid(); busy(true); const page = pages[id], cfg = getState()[id];
    try {
      const result = await request(id === 'charging' ? (stop ? 'notifications_live_stop_test' : 'notifications_live_test') : (stop ? 'notifications_live_status_stop_test' : 'notifications_live_status_test'),
        {...(id === 'charging' ? {} : {kind: id}), value: {...cfg, enabled: false, devices: getDevices(), url: getUrl() || ''}});
      const sent = result.deliveries || [], failures = sent.filter((row) => row.status === 'error');
      if (stop && !failures.length) active[id] = false; else if (!stop && sent.some((row) => row.status === 'accepted')) active[id] = true;
      page.feedback.hidden = false; page.feedback.dataset.kind = failures.length ? 'error' : 'success';
      page.feedback.textContent = failures.length ? failures.map((row) => row.error).join('; ') : stop ? (sent.length ? 'Test ended. Your real notification is unchanged.' : 'No test is running.') : 'Test sent to ' + sent.length + ' device(s). Phone delivery is not confirmed.';
      toast(failures.length ? 'Test could not be delivered.' : stop ? 'Test ended.' : 'Test sent. Check your phone.', !!failures.length);
    } catch (error) { page.feedback.hidden = false; page.feedback.dataset.kind = 'error'; page.feedback.textContent = error.message || String(error); toast(page.feedback.textContent, true); } finally { busy(false); refresh(); }
  };
  // Where the phone opens when a notification is tapped: next to "Old data protection", in the same box.
  const tapPicker = document.createElement('ha-selector'), tapPanel = el('div', 'space-y-3');
  tapPicker.hass = getHass(); tapPicker.selector = {navigation: {}}; tapPicker.label = ''; tapPicker.required = false; tapPicker.className = 'design-icon-picker';
  tapPicker.addEventListener('value-changed', (event) => { event.stopPropagation(); if (busy() || typeof event.detail?.value !== 'string' && event.detail?.value != null) return; setUrl(event.detail.value || ''); changed(); });
  tapPanel.append(el('div', 'font-bold text-[11px] text-gray-300', 'When you tap a notification'), el('p', 'text-[11px] text-gray-400 leading-relaxed', 'The dashboard page the phone opens. Empty opens the page the Home Assistant app shows by default. Alerts and live notifications use the same page.'), tapPicker);
  const old = q('#input-fresh')?.closest('.ha-card');
  if (old) { const first = el('div', 'space-y-3'); first.append(...old.childNodes); old.classList.remove('space-y-3'); old.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:start'; old.append(first, tapPanel); }
  else { const card = el('section', 'ha-card p-4'); card.append(tapPanel); overview.append(card); }
  const root = overview.getRootNode();
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest?.('[data-design-click],[data-live-back]')) { if (current) show(''); return; }
    if (busy()) return;
    const step = target.closest?.('[data-live-step]'); if (step) { const input = step.parentElement.querySelector('input'); input.value = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value) + Number(step.dataset.liveStep))); input.dispatchEvent(new Event('input', {bubbles: true})); return; }
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
    getState()[id].icon = value === KINDS[id].icon ? '' : value || ''; changed();
  });
  refresh();
  return {refresh};
}
