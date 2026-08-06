// Статус карточки (заполнена/пуста) для строки списка «Мои схемы»/«Мои
// режимы» — заполненность берётся из useMyCards, единственного источника
// правды о заметках (правило №4: денормализацию не считаем по месту).
import { useMyCards, type MyCardsKind } from '../myCards/useMyCards';
import { patternStatusText } from './patternStatus';

export function usePatternStatus(
  kind: MyCardsKind,
  entryCounts: Record<string, number>,
) {
  const { items, loading, reload } = useMyCards(kind);
  const filledIds = new Set(items.map((i) => i.id));

  function statusFor(id: string): string {
    return patternStatusText(filledIds.has(id), entryCounts[id] ?? 0);
  }

  return { items, loading, reload, statusFor };
}
