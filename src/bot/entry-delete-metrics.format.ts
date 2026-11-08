// Блок «Удаление своих записей» для /stats (правило №8: фича, которой нет в
// отчёте, — невидима). Чистый форматтер, покрыт тестом вместе с пустой БД.
// Записи в архиве «Мой путь» несут очень личный текст — важно видеть, что
// удаление вообще находят и им пользуются. Язык — простой: «удалили запись»,
// а не «entry_deleted events».
import { ENTRY_DELETE_TYPES } from '../analytics/entry-delete.constants';
import { plural } from './plural';

export interface EntryDeleteMetrics {
  /** За месяц: сколько записей удалили. */
  deleted30: number;
  /** За месяц: сколько разных людей это делали. */
  users30: number;
  /** Сколько раз удаляли каждый тип записи, по убыванию. */
  byType30: Array<{ type: string; count: number }>;
}

/** «Удалить результаты теста» целиком (событие ysq_data_deleted), за месяц. */
export interface YsqDeleteMetrics {
  deleted30: number;
  users30: number;
  /** Из них — у кого была хоть одна пройденная попытка. */
  completedUsers30: number;
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

// Стёртый тест выпадает из воронки теста в «Как пользуются продуктом» —
// строка говорит, сколько там «не дошёл» на деле «дошёл и стёр».
function ysqLine(y: YsqDeleteMetrics): string {
  const times = plural(y.deleted30, 'раз', 'раза', 'раз');
  const head = `Стёрли результаты теста схем: ${y.deleted30} ${times} · людей: ${y.users30}`;
  if (y.completedUsers30 === 0) return head;
  return `${head}, из них проходили тест до конца: ${y.completedUsers30} — в воронке теста их больше нет`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatEntryDeleteMetrics(
  m: EntryDeleteMetrics,
  ysq?: YsqDeleteMetrics,
): string {
  const lines = ['🗑 <b>Удаление своих записей</b> (за месяц)'];
  const ysqDeleted = (ysq?.deleted30 ?? 0) > 0;
  if (m.deleted30 === 0 && !ysqDeleted) {
    lines.push('Пока никто ничего не удалял.');
    return lines.join('\n');
  }
  if (m.deleted30 === 0) {
    lines.push('Отдельные записи пока никто не удалял.');
  } else {
    lines.push(`Удалили записей: ${m.deleted30} · людей: ${m.users30}`);
  }
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
  if (ysq && ysqDeleted) lines.push(ysqLine(ysq));
  return lines.join('\n');
}
