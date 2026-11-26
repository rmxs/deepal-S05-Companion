/* Sliding-pill parity: every segmented choice (.seg) on a page must look like the card's Settings .seg.
   The reference is a Settings-markup group created in the same root, so it gets the same shared rules (companion-shared.css).
   For each visible group, the .vpill (transition, top, bottom, radius, colour, height) and the button (font, weight, padding,
   radius, height, text colour when pressed) must equal the reference. host is the panel element (or an array of elements, each inside the shadow root of the last) whose shadow root holds the
   page, or null for a page without a shadow root. Used by CHARGER_PAGE_ONLY, NOTIFY_RECOMMENDED_ONLY and PRECOND_UI_ONLY. */
const assert = require('assert');

module.exports = async function segParity(page, host, selectors) {
  const result = await page.evaluate(async ({ host, selectors }) => {
    const steps = host ? [].concat(host) : [];
    const scope = steps.reduce((root, step) => root.querySelector(step).shadowRoot, document.body);
    const r1 = (el) => Math.round(el.getBoundingClientRect().height * 10) / 10;
    const read = (seg) => {
      const p = seg.querySelector(':scope > .vpill'), b = seg.querySelector(':scope > button');
      if (!p || !b) return null;
      const on = seg.querySelector(':scope > button.on') || b;
      const cp = getComputedStyle(p), cb = getComputedStyle(b), co = getComputedStyle(on);
      return { pillTransition: cp.transition, pillTop: cp.top, pillBottom: cp.bottom, pillRadius: cp.borderRadius, pillBg: cp.backgroundColor, pillH: r1(p), btnFont: cb.fontSize, btnWeight: cb.fontWeight, btnRadius: cb.borderRadius, btnPad: cb.padding, btnH: r1(b), onColour: co.color, onBg: co.backgroundColor };
    };
    const ref = document.createElement('div');
    ref.className = 'seg';
    ref.innerHTML = '<button type="button">Reference</button><button type="button" class="on">Pressed</button><button type="button">Other</button>';
    scope.append(ref);
    window.__DEEPAL_COMPANION_UI.pill(ref);
    // the pill and the pressed button animate (background .2s) when the group gets its .hp class: read the settled values
    await new Promise((done) => setTimeout(done, 500));
    const refInfo = read(ref);
    const groups = selectors.map((sel) => ({ sel, items: [...scope.querySelectorAll(sel)].filter((s) => s.getBoundingClientRect().height > 0).map(read) }));
    ref.remove();
    return { refInfo, groups };
  }, { host, selectors });
  assert(result.refInfo && result.refInfo.pillH > 0, 'the Settings reference pill renders');
  for (const group of result.groups) {
    assert(group.items.length > 0, `no visible ${group.sel} group to compare`);
    for (const item of group.items) {
      assert(item, `${group.sel} has a choice without a sliding pill`);
      const diff = Object.keys(result.refInfo).filter((k) => item[k] !== result.refInfo[k]).map((k) => `${k}: ${item[k]} (Settings ${result.refInfo[k]})`);
      assert.equal(diff.length, 0, `${group.sel} differs from the Settings .seg: ${diff.join('; ')}`);
    }
  }
  return result;
};
