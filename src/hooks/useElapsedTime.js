import { useState, useEffect } from 'react';

// Tracks elapsed run time for the trading simulator
export function useElapsedTime(running) {
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (running && !startTime) {
      setStartTime(Date.now());
    }
    if (!running && startTime) {
      setElapsedTime(Date.now() - startTime);
    }
  }, [running, startTime]);

  useEffect(() => {
    if (!running || !startTime) return;
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 500); // Update timer less frequently (was 100ms)
    return () => clearInterval(timer);
  }, [running, startTime]);

  const resetElapsedTime = () => {
    setStartTime(null);
    setElapsedTime(0);
  };

  return { elapsedTime, resetElapsedTime };
}
