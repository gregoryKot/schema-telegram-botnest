// Блок «Удаление своих записей» для /stats (правило №8: фича, которой нет в
// отчёте, — невидима). Чистый форматтер, покрыт тестом вместе с пустой БД.
// Записи в архиве «Мой путь» несут очень личный текст — важно видеть, что
// удаление вообще находят и им пользуются. Язык — простой: «удалили запись»,
// а не «entry_deleted events».
import { ENTRY_DELETE_TYPES } from '../analytics/entry-delete.constants';

export interface EntryDeleteMetrics {
  /** За месяц: сколько записей удалили. */
  deleted30: number;
  /** За месяц: сколько разных людей это делали. */
  users30: number;
  /** Сколько раз удаляли каждый тип записи, по убыванию. */
  byType30: Array<{ type: string; count: number }>;
}

// Типы записей человеческими словами: в отчёте не должно быть внутренних id.
// Сверка с реестром — в спеке форматтера (новый тип без подписи вылезет в
// отчёт голым ключом).
export const ENTRY_DELETE_TYPE_LABELS: Record<
  (typeof ENTRY_DELETE_TYPES)[number],
  string
> = {
  belief_check: 'проверка убеждения',
  letter: 'письмо себе',
  flashcard: 'кризисная карточка',
};

/** Текстовый блок для /stats. Чистая функция. */
export function formatEntryDeleteMetrics(m: EntryDeleteMetrics): string {
  const lines = ['🗑 <b>Удаление своих записей</b> (за месяц)'];
  if (m.deleted30 === 0) {
    lines.push('Пока никто ничего не удалял.');
    return lines.join('\n');
  }
  lines.push(`Удалили записей: ${m.deleted30} · людей: ${m.users30}`);
  if (m.byType30.length > 0) {
    lines.push(
      'Что удаляют: ' +
        m.byType30
          .map(
            (r) =>
              `${ENTRY_DELETE_TYPE_LABELS[r.type as keyof typeof ENTRY_DELETE_TYPE_LABELS] ?? r.type} — ${r.count}`,
          )
          .join(' · '),
    );
  }
  return lines.join('\n');
}
