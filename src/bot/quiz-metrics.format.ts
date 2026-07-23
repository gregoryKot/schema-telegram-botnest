// Блок «Мини-тесты» для /stats (правило №8: событие, которого нет в отчёте, —
// невидимо). Чистый форматтер, покрыт тестом, включая пустую БД. Язык —
// простой: «дошли до результата», а не «completed events».

export interface QuizMetrics {
  /** За месяц: сколько раз открывали первый вопрос. */
  started30: number;
  /** За месяц: сколько раз дошли до результата. */
  completed30: number;
  /** Разбивка дошедших: бот / сайт (meta.src). */
  completedBot30: number;
  completedWeb30: number;
  /** Какие тесты доходят до результата (meta.quiz), по убыванию. */
  byQuiz30: Array<{ quiz: string; count: number }>;
}

// Подписи тестов — нейтральные и короткие, без ты/вы (это отчёт админу).
// Спек-сверка: каждый id из QUIZ_IDS обязан иметь подпись (иначе в отчёте
// вылезет голый ключ вроде «drives»).
export const QUIZ_LABELS: Record<string, string> = {
  drives: '🚗 «Кто у руля»',
  critic: '🎙 «Внутренний критик»',
  battery: '🔋 «Батарейка»',
};

const pct = (part: number, whole: number): string =>
  whole === 0 ? '' : ` (${Math.round((part / whole) * 100)}%)`;

/** Текстовый блок для /stats. Чистая функция. */
export function formatQuizMetrics(m: QuizMetrics): string {
  const lines = [`🎲 <b>Мини-тесты без регистрации</b> (за месяц)`];
  if (m.started30 === 0 && m.completed30 === 0) {
    lines.push('Пока никто не пробовал — самое время о них рассказать 🙂');
    return lines.join('\n');
  }
  lines.push(
    `Начали: ${m.started30} · дошли до результата: ${m.completed30}${pct(
      m.completed30,
      m.started30,
    )}`,
  );
  lines.push(
    `Где доходят до конца: в боте ${m.completedBot30} · на сайте ${m.completedWeb30}`,
  );
  if (m.byQuiz30.length > 0) {
    lines.push(
      'Какие тесты проходят: ' +
        m.byQuiz30
          .map((q) => `${QUIZ_LABELS[q.quiz] ?? q.quiz} — ${q.count}`)
          .join(' · '),
    );
  }
  return lines.join('\n');
}
