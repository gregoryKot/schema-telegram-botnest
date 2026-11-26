import type { TechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { ExId } from '../../exercises/exerciseCatalog';
import type { SessionWorkKind } from './types';
import { TECHNIQUE_WORK } from './techniqueWork';

export { TECHNIQUE_WORK };

/** Поле пункта «Что делали»: ключ хранения и подпись в форме. */
export type WorkField = readonly [key: string, label: string];

/** Упражнения приложения: названия — exerciseCatalog (names.ts). */
export const EXERCISE_WORK_FIELDS: Record<ExId, readonly WorkField[]> = {
  belief: [
    ['belief', 'Убеждение'],
    ['evidence', 'Что нашли за и против'],
    ['result', 'Вывод'],
  ],
  schema: [
    ['learned', 'Что узнали: триггеры, тело, истоки'],
    ['fresh', 'Что оказалось новым'],
  ],
  mode: [
    ['learned', 'Что узнали: когда включается, что чувствуется'],
    ['fresh', 'Что оказалось новым'],
  ],
  letter: [
    ['main', 'Главное в письме'],
    ['reading', 'Что было, когда читали'],
  ],
  safe: [
    ['place', 'Какое место'],
    ['way', 'Что помогает туда попасть'],
    ['after', 'Состояние после'],
  ],
  wheel: [
    ['unmet', 'Какие потребности не закрывались'],
    ['discussed', 'Что обсудили'],
  ],
  warm: [
    ['words', 'Какие слова подошли'],
    ['response', 'Как отозвалось'],
  ],
  phrase: [
    ['phrases', 'Какие фразы разбирали'],
    ['insight', 'Что стало понятно'],
  ],
};

/** «Своё»: название — отдельное поле пункта (customName). */
export const CUSTOM_WORK_FIELDS: readonly WorkField[] = [
  ['what', 'Что делали'],
  ['result', 'Итог'],
];

const own = (o: object, k: unknown): k is string =>
  typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/** Поля вида; null — такого вида или id в каталоге нет. */
export function workFields(
  kind: SessionWorkKind,
  refId?: unknown,
): readonly WorkField[] | null {
  if (kind === 'custom') return CUSTOM_WORK_FIELDS;
  if (kind === 'technique')
    return own(TECHNIQUE_WORK, refId)
      ? TECHNIQUE_WORK[refId as TechniqueId].fields
      : null;
  return own(EXERCISE_WORK_FIELDS, refId)
    ? EXERCISE_WORK_FIELDS[refId as ExId]
    : null;
}
