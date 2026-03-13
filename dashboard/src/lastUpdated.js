export function formatLastUpdated(isoDate) {
  if (!isoDate) return 'Unknown';
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString('en-CA');
}

export function getProjectTimestamps(projects) {
  return projects.map(p => ({
    ...p,
    lastUpdatedDisplay: formatLastUpdated(p.lastUpdated),
  }));
}
