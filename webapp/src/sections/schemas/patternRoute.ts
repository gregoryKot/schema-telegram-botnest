// Переход к схеме или режиму «Паттернов» по адресу: общий поиск (палитра ⌘K) ведёт на /schemas с
// состоянием маршрута { openPattern }, раздел открывает экран паттерна — тот же, что по тапу в «Моих
// схемах» и «Моих режимах», — и состояние очищает: «Назад» и обновление страницы его не повторяют.
import { getModeById, getSchemaById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { useRouteStateOnce } from '../../hooks/useRouteStateOnce';
import { usePatternLayer } from './usePatternLayer';

export interface PatternTarget { kind: MyCardsKind; id: string }

export const PATTERNS_PATH = '/schemas';

/** Состояние маршрута для navigate(PATTERNS_PATH, { state }). */
export const patternRouteState = (target: PatternTarget) => ({ openPattern: { kind: target.kind, id: target.id } });

/** Цель из состояния маршрута; не своя или такой схемы (режима) нет — null. */
export function patternTargetOf(state: unknown): PatternTarget | null {
  const t = (state as { openPattern?: Partial<PatternTarget> } | null)?.openPattern;
  if (!t || typeof t.id !== 'string') return null;
  if (t.kind === 'schema') return getSchemaById(t.id) ? { kind: 'schema', id: t.id } : null;
  return t.kind === 'mode' && getModeById(t.id) ? { kind: 'mode', id: t.id } : null;
}

/** Слой паттерна раздела «Паттерны»: открывается и из состояния маршрута — один раз на переход. */
export function useRoutedPatternLayer() {
  const pat = usePatternLayer();
  useRouteStateOnce(patternTargetOf, (t) => pat.openPattern(t.kind, t.id), (t) => `${t.kind}:${t.id}`);
  return pat;
}
