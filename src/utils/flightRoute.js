const km = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Share of the trip flown, 0 to 1, from where the plane is now. */
export function routeProgress(route, at) {
  const flown = km(route.origin, at);
  const left = km(at, route.destination);
  return flown + left > 0 ? flown / (flown + left) : 0;
}

/** Popup block: "YYZ Toronto → YVR Vancouver", a progress bar and km left. */
export function routeHTML(route, at) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pct = Math.round(routeProgress(route, at) * 100);
  const left = Math.round(km(at, route.destination));
  return `<div style="margin-top:8px;font-size:11px">
    <div style="display:flex;justify-content:space-between;gap:8px;font-weight:600"><span>${esc(route.origin.code)} ${esc(route.origin.city)}</span><span>${esc(route.destination.code)} ${esc(route.destination.city)}</span></div>
    <div style="margin-top:6px;height:4px;border-radius:2px;background:rgba(148,163,184,.3)"><div style="width:${pct}%;height:100%;border-radius:2px;background:#60a5fa"></div></div>
    <div style="margin-top:4px;color:#cbd5e1">${pct}% flown · ${left.toLocaleString()} km to go${route.airline ? ` · ${esc(route.airline)}` : ''}</div>
  </div>`;
}
