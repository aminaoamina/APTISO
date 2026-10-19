import { useEffect } from 'react';

/** Calls `load` every `ms` while `active` (a background AI job is running). */
export function usePollWhile(active: boolean, load: () => unknown, ms = 3000) {
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [active, load, ms]);
}
