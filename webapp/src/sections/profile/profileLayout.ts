// Раскладка «Профиля» (b21): пустой ли профиль, какие плитки витрины видны и где на телефоне встаёт
// группа блоков. Порядок блоков — из «Настроить экран» (orderedIds), скрытие — тоже оттуда.
import type { ScreenBlockId } from '../../../../shared/src/screens/screenBlocks';

/** Плитки витрины — вход в лист своей сущности (путь, портрет, тёплые слова). */
export const SHELF_IDS = ['journey', 'portrait', 'warm_words'] as const satisfies readonly ScreenBlockId[];
export type ShelfId = (typeof SHELF_IDS)[number];

export interface FreshInput {
  totalDays: number;
  diaryCount: number;
  ysqCount: number;
  /** Схем в портрете + отмеченных режимов. */
  patterns: number;
  warmWords: number;
  earnedAchievements: number;
}

/** Профиль без единой отметки: ни дня, ни записи, ни теста, ни схемы, ни значка. Тогда вместо
 *  стены нулей и пустых карточек — сцена начала пути и одна кнопка. */
export function isFreshProfile(p: FreshInput): boolean {
  return Object.values(p).every((n) => n === 0);
}

interface Order {
  orderedIds: readonly ScreenBlockId[];
  isHidden: (id: ScreenBlockId) => boolean;
}

/** Плитки витрины пустого профиля: только «Мой путь» — шаги практик, дыхания и письма профиль не
 *  считает, а путь их показывает, поэтому плитка пути стоит и под героем начала. */
export const freshShelf = (id: ShelfId): boolean => id === 'journey';

/** Пустой профиль со скрытыми и «Мой портрет», и «Мой путь»: герой начала встаёт без блока
 *  «Настроить экран», иначе экран остался бы пустым. */
export function freshStartForced(blocks: Pick<Order, 'isHidden'>): boolean {
  return blocks.isHidden('portrait') && blocks.isHidden('journey');
}

/** Видимые блоки группы в порядке «Настроить экран»; `present` — у блока есть что показать. */
export function visibleInOrder<T extends ScreenBlockId>(
  ids: readonly T[], blocks: Order, present: (id: T) => boolean = () => true,
): T[] {
  const pos = (id: T) => {
    const i = blocks.orderedIds.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return ids.filter((id) => !blocks.isHidden(id) && present(id)).sort((a, b) => pos(a) - pos(b));
}

/** Место группы на телефоне (--blk-o): место её первого видимого блока, с 1, как у ScreenBlock. */
export function groupOrder(visible: readonly ScreenBlockId[], blocks: Order): number {
  const places = visible.map((id) => blocks.orderedIds.indexOf(id)).filter((i) => i >= 0);
  return places.length ? Math.min(...places) + 1 : 0;
}
