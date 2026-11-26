// Переход к листу «Справочника» по адресу: общий поиск (палитра ⌘K) ведёт на /cabinet/guide с
// состоянием маршрута { guideSheet }, а справочник открывает лист и состояние очищает —
// «Назад» и обновление страницы лист повторно не открывают.
import { useRouteStateOnce } from '../../hooks/useRouteStateOnce';
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

/** Открывает лист из состояния маршрута — один раз на переход (useRouteStateOnce). */
export function useRouteGuideSheet(ref: Reference, open: (item: ReferenceItem) => void): void {
  useRouteStateOnce(targetOf, (target) => {
    const item = findReferenceItem(ref, target);
    if (item) open(item);
  }, (target) => `${target.kind}:${target.id}`);
}
