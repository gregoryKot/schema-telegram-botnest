// Переход к листу «Справочника» по адресу: общий поиск (палитра ⌘K) ведёт на /cabinet/guide с
// состоянием маршрута { guideSheet }, а справочник открывает лист и состояние очищает —
// «Назад» и обновление страницы лист повторно не открывают.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { THERAPIST_NAV } from '../../components/appShell/navLook';
import type { Reference, ReferenceItem } from './guideReferenceModel';

export type GuideSheetTarget = Pick<ReferenceItem, 'kind' | 'id'>;

export const GUIDE_PATH = THERAPIST_NAV.guide.to;

/** Состояние маршрута для navigate(GUIDE_PATH, { state }). */
export const guideSheetState = (item: GuideSheetTarget) => ({ guideSheet: { kind: item.kind, id: item.id } });

function targetOf(state: unknown): GuideSheetTarget | null {
  const sheet = (state as { guideSheet?: Partial<GuideSheetTarget> } | null)?.guideSheet;
  return sheet && typeof sheet.kind === 'string' && typeof sheet.id === 'string' ? (sheet as GuideSheetTarget) : null;
}

/** Лист справочника по виду и id; такого нет — null. */
export function findReferenceItem(ref: Reference, target: GuideSheetTarget): ReferenceItem | null {
  for (const groups of Object.values(ref)) {
    for (const group of groups) {
      const item = group.items.find((i) => i.kind === target.kind && i.id === target.id);
      if (item) return item;
    }
  }
  return null;
}

/**
 * Открывает лист из состояния маршрута — один раз на переход: сначала состояние очищается (replace),
 * лист открывается следующим шагом, чтобы его запись истории легла уже поверх чистой.
 */
export function useRouteGuideSheet(ref: Reference, open: (item: ReferenceItem) => void): void {
  const location = useLocation();
  const navigate = useNavigate();
  const target = targetOf(location.state);
  const key = target ? `${target.kind}:${target.id}` : null;
  const pending = useRef<GuideSheetTarget | null>(null);
  const live = useRef({ ref, open, target });
  useLayoutEffect(() => { live.current = { ref, open, target }; });
  useEffect(() => {
    const now = live.current;
    if (now.target) {
      pending.current = now.target;
      navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
      return;
    }
    const next = pending.current;
    pending.current = null;
    const item = next && findReferenceItem(now.ref, next);
    if (item) now.open(item);
    // Только смена цели: адрес и тексты между переходом и открытием не меняются.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
