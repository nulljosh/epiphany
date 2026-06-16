import { useEffect } from 'react';

// Space: start/stop (or reset if busted/won) -- R: reset
export function useTradeShortcuts({ busted, won, reset, setRunning }) {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (busted || won) {
          reset();
        } else {
          setRunning(r => !r);
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        reset();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [busted, won, reset, setRunning]);
}
