import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Pushes a history entry via React Router when a sheet mounts so the
 * browser back button closes the sheet instead of navigating away.
 *
 * Uses useNavigate/useLocation so React Router knows about the entry —
 * bypassing the router with history.pushState caused both the sheet to
 * close AND the router to navigate back simultaneously.
 *
 * Returns a `goBack` function — use it for ALL close/back actions inside
 * the sheet so that history entries are never orphaned.
 */
export function useHistorySheet(onClose: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(onClose);
  ref.current = onClose;
  // Unique ID for this sheet instance so nested sheets don't interfere
  const id = useRef(`sheet_${Date.now()}_${Math.random()}`);
  const ready = useRef(false);

  useEffect(() => {
    navigate(location.pathname + location.search + location.hash, {
      replace: false,
      state: { ...(location.state ?? {}), __sheetId: id.current },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready.current) {
      // Wait until our navigate has committed
      if ((location.state as any)?.__sheetId === id.current) ready.current = true;
      return;
    }
    // Our entry is gone from history (user pressed back) — close the sheet
    if ((location.state as any)?.__sheetId !== id.current) {
      ref.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return () => navigate(-1);
}
