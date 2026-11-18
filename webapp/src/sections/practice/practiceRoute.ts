// Переход внутрь «Практик» по адресу: общий поиск (палитра ⌘K) ведёт на /practice с состоянием маршрута
// { practiceOpen } — упражнение библиотеки или «Мои планы»; «О схеме» — с { openSchemaEx } (карточка
// схемы). Раздел исполняет цель один раз: «Назад» и обновление страницы её не повторяют.
import { EXERCISES, type ExId } from '../../../../shared/src/exercises/exerciseCatalog';
import { useRouteStateOnce } from '../../hooks/useRouteStateOnce';

export type PracticeTarget = { kind: 'exercise'; id: ExId } | { kind: 'plans' } | { kind: 'schemaCard'; id: string };

export const PRACTICE_PATH = '/practice';

/** Состояние маршрута для navigate(PRACTICE_PATH, { state }). */
export const practiceRouteState = (target: PracticeTarget) => ({ practiceOpen: target });

/** Цель из состояния маршрута; не своя или такого упражнения нет — null. */
export function practiceTargetOf(state: unknown): PracticeTarget | null {
  const s = state as { practiceOpen?: { kind?: unknown; id?: unknown }; openSchemaEx?: unknown } | null;
  if (typeof s?.openSchemaEx === 'string' && s.openSchemaEx) return { kind: 'schemaCard', id: s.openSchemaEx };
  const t = s?.practiceOpen;
  if (t?.kind === 'plans') return { kind: 'plans' };
  const ex = t?.kind === 'exercise' ? EXERCISES.find((e) => e.id === t.id) : undefined;
  return ex ? { kind: 'exercise', id: ex.id } : null;
}

interface Open { exercise: (id: ExId) => void; schemaCard: (schemaId: string) => void; plans: () => void }

/** Исполняет цель из состояния маршрута — один раз на переход (useRouteStateOnce). */
export function useRoutePractice(open: Open): void {
  useRouteStateOnce(practiceTargetOf, (t) => {
    if (t.kind === 'plans') open.plans();
    else if (t.kind === 'exercise') open.exercise(t.id);
    else open.schemaCard(t.id);
  }, (t) => (t.kind === 'plans' ? t.kind : `${t.kind}:${t.id}`));
}
