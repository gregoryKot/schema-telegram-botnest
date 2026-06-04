import { useEffect, useState } from 'react';

// True when the viewport is narrow (phone / small tablet). Updates on resize.
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return mobile;
}
