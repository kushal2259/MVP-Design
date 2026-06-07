'use client';
import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is at or below `breakpoint` (default 768px).
 * SSR-safe: returns false on the server, then updates after mount.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
