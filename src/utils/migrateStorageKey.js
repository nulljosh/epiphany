const MIGRATIONS = [
  ['monica_sw_cleared',      'epiphany_sw_cleared'],
  ['monica_run_history',     'epiphany_run_history'],
  ['monica_broker_config',   'epiphany_broker_config'],
  ['monica_broker_autosend', 'epiphany_broker_autosend'],
  ['monica_last_geo',        'epiphany_last_geo'],
  ['monica_geo_granted',     'epiphany_geo_granted'],
  ['monica_portfolio',       'epiphany_portfolio'],
  ['monica_watchlist',       'epiphany_watchlist'],
];

export function migrateStorageKeys() {
  try {
    for (const [oldKey, newKey] of MIGRATIONS) {
      if (localStorage.getItem(newKey) === null) {
        const val = localStorage.getItem(oldKey);
        if (val !== null) localStorage.setItem(newKey, val);
      }
      localStorage.removeItem(oldKey);
    }
  } catch {}
}
