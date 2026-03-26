import { useState, useEffect, useCallback } from 'react';

const SHORTCUTS = [
  { key: '?', description: 'Toggle this help overlay' },
  { key: 'Escape', description: 'Close overlays / panels' },
  { key: '\u2318K', description: 'Command bar (search everything)' },
  { key: '1-5', description: 'Switch tabs (Markets, Portfolio, Situation, People, Settings)' },
  { key: 'f', description: 'Open Finance Panel' },
  { key: 's', description: 'Open Situation Monitor' },
  { key: 'm', description: 'Toggle map controls' },
];

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '?') {
      e.preventDefault();
      setShowHelp((prev) => !prev);
    }
    if (e.key === 'Escape' && showHelp) {
      setShowHelp(false);
    }
  }, [showHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, SHORTCUTS };
}
