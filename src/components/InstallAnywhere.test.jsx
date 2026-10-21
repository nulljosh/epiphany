import { describe, it, expect } from 'vitest';
import { detectPlatform } from './InstallAnywhere';

describe('detectPlatform', () => {
  it('treats phones and iPads as mobile, so the section hides', () => {
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe('mobile');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile' })).toBe('mobile');
    // iPadOS sends a Mac user agent
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe('mobile');
  });

  it('tells desktops apart', () => {
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe('mac');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe('windows');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe('desktop');
  });
});
