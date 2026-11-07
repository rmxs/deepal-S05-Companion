/* One bundled resource; retries the short period before HA exposes custom integrations. */
(() => {
  const path = "/deepal_companion/frontend/companion-card.js?v=0.1.3";
  if (customElements.get("deepal-companion-card") || window.__deepalCompanionLoading) return;
  window.__deepalCompanionLoading = true;
  let attempts = 0;
  function load() {
    const script = document.createElement("script");
    script.src = path;
    script.onload = () => { window.__deepalCompanionLoading = false; };
    script.onerror = () => {
      script.remove();
      if (++attempts < 30) setTimeout(load, Math.min(15000, attempts * 1000));
      else window.__deepalCompanionLoading = false;
    };
    document.head.appendChild(script);
  }
  load();
})();
