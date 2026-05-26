import { useEffect, useRef } from 'react';

/**
 * Pushes a history entry when a sheet mounts so the browser back button
 * closes the sheet instead of navigating away from the app.
 *
 * Returns a `goBack` function — use it for ALL close/back actions inside
 * the sheet so that history entries are never orphaned.
 */
export function useHistorySheet(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;

  useEffect(() => {
    history.pushState({ sheet: true }, '');
    const handler = () => ref.current();
    window.addEventListener('popstate', handler, { once: true });
    return () => window.removeEventListener('popstate', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return () => history.back();
}
