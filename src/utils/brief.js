// The daily brief as one passage to read aloud: the summary, then each point. Mirrors BriefSpeech.text.
export function briefSpeech(brief) {
  if (!brief) return '';
  return [brief.summary, ...(brief.points || [])].filter(Boolean).map((s) => s.trim().replace(/[.!?]?$/, '.')).join(' ');
}
