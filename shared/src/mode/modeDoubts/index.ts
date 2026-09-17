/**
 * Реестр «с чем путают режим» — 38 пар покрывающих все 35 режимов схема-
 * терапии, склейка по кластерам (child/coping/control/grandiose/critic —
 * каждый ≤150 строк, правило №10 CLAUDE.md). Источник для «Сомневаешься?
 * Сравни с похожими» (карточка выбранного режима).
 */
import { CHILD_MODE_DOUBTS } from './child';
import { COPING_MODE_DOUBTS } from './coping';
import { CONTROL_MODE_DOUBTS } from './control';
import { GRANDIOSE_MODE_DOUBTS } from './grandiose';
import { CRITIC_MODE_DOUBTS } from './critic';
import type { ModeDoubtPair } from './types';

export type { ModeDoubtPair } from './types';

export const MODE_DOUBT_PAIRS: ModeDoubtPair[] = [
  ...CHILD_MODE_DOUBTS,
  ...COPING_MODE_DOUBTS,
  ...CONTROL_MODE_DOUBTS,
  ...GRANDIOSE_MODE_DOUBTS,
  ...CRITIC_MODE_DOUBTS,
];

/** Пара с точки зрения одного режима: id соседа + суть различия + проверка. */
export interface ModeDoubtEntry {
  otherId: string;
  gist: string;
  check: string;
}

/**
 * Пары «с чем путают режим», видимые с обеих сторон симметрии: для a↔b
 * getDoubtsForMode(a) и getDoubtsForMode(b) оба возвращают запись про
 * соседа. Пустой массив — валидный ответ (кнопка «Сомневаешься?» не рендерится).
 */
export function getDoubtsForMode(modeId: string): ModeDoubtEntry[] {
  const result: ModeDoubtEntry[] = [];
  for (const pair of MODE_DOUBT_PAIRS) {
    if (pair.a === modeId) {
      result.push({ otherId: pair.b, gist: pair.gist, check: pair.check });
    } else if (pair.b === modeId) {
      result.push({ otherId: pair.a, gist: pair.gist, check: pair.check });
    }
  }
  return result;
}
