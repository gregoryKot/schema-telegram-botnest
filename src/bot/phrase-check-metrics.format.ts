// Блок «Разбор фразы» для /stats (правило №8: фича, которой нет в отчёте, —
// невидима). Чистый форматтер, покрыт тестом вместе с пустой БД. Язык —
// простой: «переписали фразу», а не «rewrite conversion».
import { PHRASE_MARK_IDS } from './phrase-check.constants';

export interface PhraseCheckMetrics {
  /** За месяц: сколько разборов сохранили. */
  checks30: number;
  /** За месяц: сколько разных людей это делали. */
  users30: number;
  /** Из них — с переписанной фразой (главный смысл упражнения). */
  withRewrite30: number;
  /** Сколько раз отмечали каждую примету, по убыванию. */
  marks30: Array<{ mark: string; count: number }>;
}

// Приметы человеческими словами: в отчёте не должно быть внутренних id.
// Сверка с реестром — в спеке форматтера (новая примета без подписи вылезет
// в отчёт голым ключом).
export const PHRASE_MARK_LABELS: Record<
  (typeof PHRASE_MARK_IDS)[number],
  string
> = {
  goal: 'сказана, чтобы ткнуть в промах',
  notok: 'говорит «со мной что-то не так»',
  person: 'ругает не поступок, а себя',
  label: 'судит вместо фактов',
  fear: 'толкает страхом, а не желанием',
  never: 'ей всегда мало',
  mistake: 'ошибка = провал',
  absolute: '«всегда» и «никогда»',
  worth: 'ценность зависит от результата',
};

const pct = (part: number, whole: number): string =>
  whole === 0 ? '' : ` (${Math.round((part / whole) * 100)}%)`;

/** Текстовый блок для /stats. Чистая функция. */
export function formatPhraseCheckMetrics(m: PhraseCheckMetrics): string {
  const lines = ['🔎 <b>Разбор фразы: критик или забота</b> (за месяц)'];
  if (m.checks30 === 0) {
    lines.push(
      'Пока никто не разбирал свои фразы — упражнение ещё не нашли 🙂',
    );
    return lines.join('\n');
  }
  lines.push(`Разобрали фраз: ${m.checks30} · людей: ${m.users30}`);
  lines.push(
    `Дошли до переписывания: ${m.withRewrite30}${pct(
      m.withRewrite30,
      m.checks30,
    )}`,
  );
  if (m.marks30.length > 0) {
    lines.push(
      'Что замечают в своих фразах: ' +
        m.marks30
          .map(
            (r) =>
              `${PHRASE_MARK_LABELS[r.mark as keyof typeof PHRASE_MARK_LABELS] ?? r.mark} — ${r.count}`,
          )
          .join(' · '),
    );
  }
  return lines.join('\n');
}
