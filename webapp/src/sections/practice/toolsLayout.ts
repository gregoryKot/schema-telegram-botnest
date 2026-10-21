// Как «Инструменты» из реестра быстрых действий ложатся на раздел «Практика»
// сайта. В мини-аппе это один плоский список; на сайте пункты живут в разных
// местах: карточки библиотеки, «Мне плохо», «Мои цели», строки «Каталогов».
// Скрытие работает везде, порядок — только у карточек библиотеки.
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import type { ExId } from './exerciseLibrary';

/** Карточки библиотеки, у которых есть пункт «Инструментов». «Карточка схемы» и
 * «Карточка режима» здесь не значатся: их нет в реестре, они не скрываются и
 * не переставляются. */
export const EXERCISE_TOOL: Partial<Record<ExId, QuickActionId>> = {
  belief: 'belief_check',
  letter: 'letter_to_self',
  safe: 'safe_place',
  wheel: 'childhood_wheel',
  warm: 'warm_words',
  phrase: 'phrase_check',
};

/** Пункты, у которых на сайте есть карточка в «Инструментах» (в порядке
 * библиотеки): их порядок меняется ручкой в листе. */
export const CARD_TOOL_IDS: QuickActionId[] = Object.values(EXERCISE_TOOL);

interface Card { id: ExId; num: string }

/**
 * Карточки библиотеки в порядке пользователя и без скрытых. Карточки с
 * пунктом реестра занимают свои места в порядке `orderedToolIds`; карточки без
 * пункта (схема, режим) остаются на местах, где стояли. Номера «01…» идут по
 * показанному порядку: после перестановки или скрытия они не должны прыгать.
 */
export function arrangeExercises<T extends Card>(
  cards: T[],
  orderedToolIds: readonly string[],
  hidden: readonly string[],
): T[] {
  const rank = (c: T) => {
    const tool = EXERCISE_TOOL[c.id];
    const i = tool ? orderedToolIds.indexOf(tool) : -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const mapped = cards.filter((c) => EXERCISE_TOOL[c.id]).sort((a, b) => rank(a) - rank(b));
  let next = 0;
  const placed = cards.map((c) => (EXERCISE_TOOL[c.id] ? mapped[next++] : c));
  return placed
    .filter((c) => !hidden.includes(EXERCISE_TOOL[c.id] ?? ''))
    .map((c, i) => ({ ...c, num: String(i + 1).padStart(2, '0') }));
}
