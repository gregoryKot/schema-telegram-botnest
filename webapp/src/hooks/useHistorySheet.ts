import { useEffect, useLayoutEffect, useRef, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { markSheetOpen } from './openSheets';
import { PAGE_LIFE, backDepth, pushSheetState, sheetStackOf } from './historySheetStack';

/**
 * Запись листа в истории через React Router (history.pushState в обход роутера
 * закрывал лист И уводил назад): «Назад» браузера закрывает лист. `goBack` — для
 * ВСЕХ закрытий в листе; `goBack(then)` — «закрыть свой и открыть соседний»: then
 * идёт после onClose, когда снятие записи дошло до истории (пуш соседа в одном
 * такте с go(-1) терялся в Chromium). onClick={goBack} даёт событие — не then.
 */
// Стек id смонтированных листов — модульный, не state хука: Escape с общего
// document-листенера закрывает ИМЕННО верхний лист из наложенных (иначе все разом).
const openSheetIds: string[] = [];

export function useHistorySheet(onClose: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(onClose);
  const loc = useRef(location);
  // Рефы — в эффекте, а не в рендере (react-hooks/refs); layout-эффект идёт до
  // пассивных: goBack из эффекта ребёнка видит запись этого же коммита.
  useLayoutEffect(() => { ref.current = onClose; loc.current = location; });
  // Стабильный уникальный ID инстанса (useId — react-hooks/purity) с меткой
  // жизни страницы: запись истории переживает перезагрузку, счётчик useId — нет.
  const id = PAGE_LIFE + useId();
  const ready = useRef(false);
  const then = useRef<(() => void) | null>(null);
  const closing = useRef(false); // goBack ушёл, переход ещё не пришёл

  useEffect(() => {
    navigate(location.pathname + location.search + location.hash, { replace: false, state: pushSheetState(location.state, id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    closing.current = false; // переход пришёл
    if (!ready.current) { // ждём коммита своего navigate
      if (sheetStackOf(location.state).includes(id)) ready.current = true;
      return;
    }
    // Запись ушла из истории («Назад» или goBack) — закрываем лист, затем then.
    if (sheetStackOf(location.state).includes(id)) return;
    const next = then.current; then.current = null;
    ref.current(); next?.();
  }, [location, id]);

  useEffect(() => {
    openSheetIds.push(id);
    const unmark = markSheetOpen(id);
    return () => {
      unmark();
      const idx = openSheetIds.lastIndexOf(id);
      if (idx !== -1) openSheetIds.splice(idx, 1);
    };
  }, [id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return; // диалог поверх уже закрылся (dialogStack)
      // Не верхний из наложенных листов — Escape его не касается.
      if (openSheetIds[openSheetIds.length - 1] !== id) return;
      navigate(-backDepth(loc.current.state, id));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [id, navigate]);

  // goBack закрывает СВОЙ лист: снимает его запись и всё, что легло сверху (запись
  // ребёнка, в том числе брошенную без goBack). Повтор до прихода перехода (dblclick)
  // и вызов при уже снятой записи (`await save(); goBack()` после «Назад») — no-op,
  // иначе уход на запись дальше, вплоть до ухода со страницы.
  return (next?: unknown) => {
    if (closing.current || (ready.current && !sheetStackOf(loc.current.state).includes(id))) return;
    closing.current = true;
    then.current = typeof next === 'function' ? (next as () => void) : null;
    navigate(-backDepth(loc.current.state, id));
  };
}
