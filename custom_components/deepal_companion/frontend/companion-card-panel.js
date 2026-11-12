import "/deepal_companion/frontend/companion-card.js?v=0.1.7";

const TAG = "deepal-companion-card";
const selectionKey = hass => "deepal-companion-selection:" + String(hass?.user?.id || "local");
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

// A page that shows only the Companion card: no profile dropdown, no toolbar, no settings.
// It uses the profile and design fixed for this page in Card Settings → Vehicle, otherwise the profile last chosen in Card Settings (kept in this browser), otherwise the first one.
class DeepalCompanionCardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: "open"});
    const style = document.createElement("style");
    style.textContent = ":host{display:block;box-sizing:border-box;background:var(--primary-background-color);color:var(--primary-text-color)}"
      + ".page{box-sizing:border-box;width:100%;max-width:960px;margin:0 auto;padding:12px 12px calc(12px + env(safe-area-inset-bottom))}"
      + "@media(max-width:699px){.page{min-height:var(--card-page-h,100dvh);padding:0}}"
      + ".note{padding:32px 16px;text-align:center;color:var(--secondary-text-color)}"
      + TAG + "{display:block;width:100%}";
    this.page = document.createElement("div");
    this.page.className = "page";
    this.shadowRoot.append(style, this.page);
  }
  set hass(hass) {
    this._hass = hass;
    if (this.card) this.card.hass = hass;
    if (!this.started) { this.started = true; this.start(); }
  }
  // Home Assistant also passes narrow, route and panel; the card does not need them.
  set narrow(_) {}
  set route(_) {}
  set panel(_) {}
  /* The page height is what is left below Home Assistant's own top area (status bar, header), so the card never ends below the screen */
  fit = () => { const top = Math.max(0, Math.round(this.getBoundingClientRect().top)), h = Math.round(window.visualViewport?.height || window.innerHeight); const bar = window.innerWidth < 700 ? Math.round(h * 0.04) : 0; /* phones: leave room for the bottom bar / gesture area */
    if (h > 0 && window.innerWidth < 700) this.style.setProperty("--card-page-h", Math.max(320, h - top - bar) + "px"); else this.style.removeProperty("--card-page-h"); };
  disconnectedCallback() { this.gone = true; window.removeEventListener("resize", this.fit); window.removeEventListener("orientationchange", this.fit); window.visualViewport?.removeEventListener("resize", this.fit); }
  connectedCallback() { this.gone = false; this.fit(); requestAnimationFrame(this.fit); window.addEventListener("resize", this.fit); window.addEventListener("orientationchange", this.fit); window.visualViewport?.addEventListener("resize", this.fit); }
  async start() {
    try {
      const rows = await this._hass.callWS({type: "deepal_companion/request", op: "list"});
      if (this.gone) return;
      const choices = rows.flatMap(car => car.views.map(view => ({vehicle_id: car.id, view_id: view.id})));
      if (!choices.length) { this.page.innerHTML = '<p class="note">No Deepal vehicle is set up yet.</p>'; return; }
      // A profile and design fixed by an administrator for this page win over this browser's last choice.
      let pin = {};
      try { pin = await this._hass.callWS({type: "deepal_companion/card_panel"}) || {}; } catch (_) {}
      if (this.gone) return;
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(selectionKey(this._hass)) || "null") || {}; } catch (_) {}
      const pinned = pin.view_id ? choices.find(c => c.vehicle_id === pin.vehicle_id && c.view_id === pin.view_id) : null;
      const choice = pinned || choices.find(c => c.vehicle_id === saved.vehicle_id && c.view_id === saved.view_id) || choices[0];
      this.show(choice, pin.design || "");
    } catch (error) {
      if (!this.gone) this.page.innerHTML = '<p class="note" role="alert">' + escape(error?.message || "Deepal Companion could not be loaded.") + "</p>";
    }
  }
  show(choice, design = "") {
    this.card?.remove();
    const card = document.createElement(TAG);
    card.setConfig({type: "custom:" + TAG, vehicle_id: choice.vehicle_id, view_id: choice.view_id});
    card.setAttribute("data-app", ""); card._pageDesign = design; /* the card reads this when it picks its layout; it is never saved to the profile */
    card.hass = this._hass;
    this.card = card;
    this.page.append(card);
  }
}
if (!customElements.get("deepal-companion-card-panel")) customElements.define("deepal-companion-card-panel", DeepalCompanionCardPanel);
