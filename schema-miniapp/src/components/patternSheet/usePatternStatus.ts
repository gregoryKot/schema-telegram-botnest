// Тонкая привязка общего хука к api мини-аппа: логика статуса карточки живёт
// в shared/src/pattern (правило №3 — один источник для сайта и мини-аппа),
// здесь только транспорт. Файл остаётся, чтобы потребители и их моки по пути
// не менялись.
import { api } from '../../api';
import { usePatternStatus as usePatternStatusShared } from '../../../../shared/src/pattern/usePatternStatus';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

export function usePatternStatus(
  kind: MyCardsKind,
  entryCounts: Record<string, number>,
) {
  return usePatternStatusShared(kind, entryCounts, api);
}
