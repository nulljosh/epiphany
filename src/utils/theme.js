// Apple Liquid Glass Theme
export const darkTheme = {
  bg: '#111111',
  surface: 'rgba(28,28,30,0.8)',
  glass: 'rgba(255,255,255,0.06)',
  glassHover: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.1)',
  text: '#e8e8e8',
  textSecondary: 'rgba(255,255,255,0.5)',
  textTertiary: 'rgba(255,255,255,0.25)',
  accent: '#0a84ff',
  blue: '#0a84ff',
  backgroundSecondary: 'rgba(255,255,255,0.08)',
  green: '#30D158',
  red: '#FF453A',
  yellow: '#FFD60A',
  orange: '#FF9F0A',
  purple: '#BF5AF2',
  cyan: '#64D2FF',
  pink: '#FF375F',
};

export const lightTheme = {
  bg: '#fafafa',
  surface: '#FFFFFF',
  glass: 'rgba(255,255,255,0.92)',
  glassHover: '#FFFFFF',
  border: 'rgba(0,0,0,0.1)',
  text: '#000000',
  textSecondary: 'rgba(0,0,0,0.5)',
  textTertiary: 'rgba(0,0,0,0.3)',
  accent: '#0a84ff',                    // Readout blue
  blue: '#0a84ff',
  backgroundSecondary: 'rgba(0,0,0,0.04)',
  green: '#34C759',
  red: '#FF3B30',
  yellow: '#FFCC00',
  orange: '#FF9500',
  purple: '#AF52DE',
  cyan: '#5AC8FA',
  pink: '#FF2D55',
};

export const getTheme = (dark) => dark ? darkTheme : lightTheme;

const NIGHT_START_HOUR = 19;
const NIGHT_END_HOUR = 7;

export function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export function resolveAutoTheme({
  now = new Date(),
  prefersDark,
  prefersLight,
} = {}) {
  const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const darkMatch = typeof prefersDark === 'boolean'
    ? prefersDark
    : hasMatchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  const lightMatch = typeof prefersLight === 'boolean'
    ? prefersLight
    : hasMatchMedia
      ? window.matchMedia('(prefers-color-scheme: light)').matches
      : false;

  if (darkMatch) return 'dark';
  if (lightMatch) return 'light';
  return 'dark';
}

export function applyResolvedTheme(themeName) {
  if (typeof document === 'undefined') return;
  const resolved = themeName === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  root.style.backgroundColor = resolved === 'dark' ? '#111111' : '#fafafa';
  document.body.style.backgroundColor = resolved === 'dark' ? '#111111' : '#fafafa';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', resolved === 'dark' ? '#111111' : '#fafafa');
  }
}

// Probability color helper
export const getProbColor = (p, t) => {
  if (p >= 0.15) return t.green;
  if (p >= 0.02) return t.yellow;
  return t.red;
};
