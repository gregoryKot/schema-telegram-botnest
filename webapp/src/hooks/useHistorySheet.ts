import { useEffect, useRef, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Pushes a history entry via React Router when a sheet mounts so the
 * browser back button closes the sheet instead of navigating away.
 *
 * Uses useNavigate/useLocation so React Router knows about the entry –
 * bypassing the router with history.pushState caused both the sheet to
 * close AND the router to navigate back simultaneously.
 *
 * Returns a `goBack` function – use it for ALL close/back actions inside
 * the sheet so that history entries are never orphaned.
 */
// Ж5 дизайн-аудита 2026-08: webapp не слушал Escape вовсе (miniapp — слушал).
// Стек id смонтированных history-шитов — модульный, не state хука: нужен
// только чтобы Escape с общего document-листенера закрывал ИМЕННО верхний
// лист при нескольких наложенных (иначе сработали бы все разом). Пуш/поп
// синхронны с mount/unmount эффектом ниже — верхушка стека всегда совпадает
// с последним открытым листом.
const openSheetIds: string[] = [];

export function useHistorySheet(onClose: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(onClose);
  // Держим ref.current актуальным в эффекте, а не в рендере (react-hooks/refs):
  // ref.current читается только из пост-коммит эффекта ниже, так что этого
  // достаточно.
  useEffect(() => {
    ref.current = onClose;
  });
  // Стабильный уникальный ID инстанса (useId вместо Date.now/Math.random в
  // рендере — react-hooks/purity), чтобы вложенные листы не пересекались.
  const id = useId();
  const ready = useRef(false);

  useEffect(() => {
    navigate(location.pathname + location.search + location.hash, {
      replace: false,
      state: { ...(location.state ?? {}), __sheetId: id },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready.current) {
      // Wait until our navigate has committed
      if ((location.state as { __sheetId?: string } | null)?.__sheetId === id) ready.current = true;
      return;
    }
    // Our entry is gone from history (user pressed back) – close the sheet
    if ((location.state as { __sheetId?: string } | null)?.__sheetId !== id) {
      ref.current();
    }
  }, [location, id]);

  useEffect(() => {
    openSheetIds.push(id);
    return () => {
      const idx = openSheetIds.lastIndexOf(id);
      if (idx !== -1) openSheetIds.splice(idx, 1);
    };
  }, [id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Не верхний из наложенных листов — Escape его не касается.
      if (openSheetIds[openSheetIds.length - 1] !== id) return;
      navigate(-1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [id, navigate]);

  return () => navigate(-1);
}
