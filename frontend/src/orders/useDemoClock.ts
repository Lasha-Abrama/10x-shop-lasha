import { useEffect, useState } from 'react';

// Mounted only for a nonempty history or a resolved order detail, never per row.
export function useDemoClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
