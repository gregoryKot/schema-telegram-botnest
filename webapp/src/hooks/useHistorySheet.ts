import { useEffect, useLayoutEffect, useRef, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PAGE_LIFE, backDepth, pushSheetState, sheetStackOf } from './historySheetStack';

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
// Стек id смонтированных листов — модульный, не state хука: Escape с общего
// document-листенера закрывает ИМЕННО верхний лист из наложенных (иначе
// сработали бы все разом). Пуш/поп синхронны с mount/unmount эффектом ниже.
const openSheetIds: string[] = [];

export function useHistorySheet(onClose: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(onClose);
  const loc = useRef(location);
  // Рефы — в эффекте, а не в рендере (react-hooks/refs); layout-эффект идёт до
  // пассивных: goBack из эффекта ребёнка видит запись этого же коммита.
  useLayoutEffect(() => {
    ref.current = onClose;
    loc.current = location;
  });
  // Стабильный уникальный ID инстанса (useId — react-hooks/purity) с меткой
  // жизни страницы: запись истории переживает перезагрузку, счётчик useId — нет.
  const id = PAGE_LIFE + useId();
  const ready = useRef(false);

  useEffect(() => {
    navigate(location.pathname + location.search + location.hash, {
      replace: false,
      state: pushSheetState(location.state, id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready.current) {
      // Wait until our navigate has committed
      if (sheetStackOf(location.state).includes(id)) ready.current = true;
      return;
    }
    // Our entry is gone from history (user pressed back) – close the sheet
    if (!sheetStackOf(location.state).includes(id)) ref.current();
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
      navigate(-backDepth(loc.current.state, id));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [id, navigate]);

  // goBack закрывает СВОЙ лист: снимает его запись и всё, что легло сверху
  // (запись ребёнка, в том числе брошенную без goBack), — не одну верхнюю.
  return () => navigate(-backDepth(loc.current.state, id));
}
