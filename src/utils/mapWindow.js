// How far back the map's timed layers reach. Items with no time, or one we can't read,
// stay: hiding them would empty layers that never send one. Same rule as Shared/MapWindow.swift.
export function inWindow(stamp, hours, now = Date.now()) {
  if (!hours || stamp == null || stamp === '') return true;
  const ms = typeof stamp === 'number' ? stamp : Date.parse(stamp);
  return Number.isNaN(ms) || now - ms <= hours * 3600000;
}
