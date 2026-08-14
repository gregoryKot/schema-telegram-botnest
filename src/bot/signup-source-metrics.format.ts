import type { SignupSource } from '../analytics/signup-sources.constants';

// Блок «Откуда пришли новенькие» для /stats (правило №8: событие, которого
// нет в отчёте, — невидимо). Считает событие signup_source — атрибуцию
// платных посевов в Telegram-каналах по ссылке `t.me/<bot>?start=src_<slug>`.
// Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Язык простой, без терминов (правило №8): «пришли по ссылке», а не
// «attribution»/«source». Разбивка на 7 и 30 дней — чтобы было видно эффект
// свежей закупки, а не только суммарный итог месяца.

export interface SignupSourceBreakdown {
  src: SignupSource;
  /** За 7 дней. */
  count7: number;
  /** За 30 дней. */
  count30: number;
}

export interface SignupSourceMetrics {
  total7: number;
  total30: number;
  /** По одной записи на каждый источник из allow-list, в фиксированном порядке. */
  bySource: SignupSourceBreakdown[];
}

// Человеческие подписи источников — то, что видит владелец в /stats, а не
// сырые слаги ссылок. Record гарантирует полноту на этапе компиляции: забыть
// подпись для нового источника из SIGNUP_SOURCES не получится.
const SOURCE_LABELS: Record<SignupSource, string> = {
  seed1: 'Посев №1',
  seed2: 'Посев №2',
  channel: 'Свой канал',
  therapist: 'От терапевтов-партнёров',
  other: 'Без метки/непонятно откуда',
};

/** Текстовый блок для /stats. Чистая функция. */
export function formatSignupSourceMetrics(m: SignupSourceMetrics): string {
  const lines = ['🌱 <b>Откуда пришли новенькие</b> (по ссылкам на посевах)'];
  if (m.total30 === 0) {
    lines.push('Пока никто не пришёл по помеченной ссылке.');
    return lines.join('\n');
  }
  lines.push(
    `Всего пришло по ссылкам: ${m.total30} за месяц, ${m.total7} за неделю`,
  );
  for (const b of m.bySource) {
    if (b.count30 === 0) continue;
    lines.push(
      `• ${SOURCE_LABELS[b.src]}: ${b.count30} за месяц, ${b.count7} за неделю`,
    );
  }
  return lines.join('\n');
}
