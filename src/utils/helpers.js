// Truncate long strings with ellipsis
export const tldr = (question, maxLen = 50) => {
  if (!question || question.length <= maxLen) return question;
  const truncated = question.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + '...';
};

// Default fetch timeout for API calls (ms)
export const FETCH_TIMEOUT = 8000;

// Fetch with AbortSignal timeout -- throws on non-ok responses
export async function fetchWithTimeout(url, ms = FETCH_TIMEOUT) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Fetch that returns null on JSON parse failure instead of throwing
export async function fetchJsonGraceful(url, ms = FETCH_TIMEOUT) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  try { return await res.json(); } catch { return null; }
}
