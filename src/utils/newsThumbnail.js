// Thumbnail for a news article row.
//
// Only GDELT articles carry a real per-article image (`socialimage`). Google
// News RSS carries none — no media:content, no enclosure, no <img> — and it
// supplies the bulk of the feed whenever GDELT is rate-limiting us. That left
// every row showing the same generic newspaper glyph.
//
// Fallback is the publisher's own logo, keyed off the domain in the feed's
// <source url="...">, so rows stay visually distinct and branded without an
// extra server-side fetch per article.
// ponytail: publisher favicon, not a true per-article image. Upgrading means
// resolving Google's opaque redirect URLs and scraping og:image per article —
// ~2 network round-trips per row. Only worth it if GDELT stays dead.

export function faviconFor(sourceUrl, source) {
  const domain = domainOf(sourceUrl) || domainOf(source && `https://${source}`);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function newsThumbnail(article) {
  if (!article) return null;
  return article.image || faviconFor(article.sourceUrl, article.source);
}

function domainOf(raw) {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    // "The Guardian" style display names parse as a bare hostname with no dot.
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}
