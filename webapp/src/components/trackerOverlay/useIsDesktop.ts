import { useState, useEffect } from 'react';

export function useIsDesktop() {
  const [d, setD] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return d;
}
