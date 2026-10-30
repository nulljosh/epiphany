import { describe, expect, it } from 'vitest';
import { briefSpeech } from './brief';

describe('briefSpeech', () => {
  it('reads the summary then each point as sentences', () => {
    expect(briefSpeech({ summary: 'Stocks rose', points: ['NVDA up 3%', 'Oil fell.'] })).toBe('Stocks rose. NVDA up 3%. Oil fell.');
    expect(briefSpeech(null)).toBe('');
  });
});
