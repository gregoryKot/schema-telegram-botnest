// Блок «Быстрые практики «Здесь и сейчас»» для /stats (правило №8: событие/
// метрика, которой нет в отчёте, — невидима). Один блок на все три практики
// (дыхание/заземление/«Стоп») — «запускали» (нажал кнопку) и «прошли до
// конца» (реальное прохождение) рядом, чтобы не плодить два похожих блока.
// Чистый форматтер, покрыт тестом, включая пустую БД.

export interface PracticeMetrics {
  /** started — нажал «начать» (событие); completed — реально прошёл до конца. */
  breathing: { started: number; completed: number };
  /** У заземления нет события старта — только факт прохождения. */
  grounding: { completed: number };
  stop: { started: number; completed: number };
  /** За месяц: сколько разных людей хоть раз прошли ЛЮБУЮ из трёх до конца. */
  distinctUsers: number;
}

const startedAndCompleted = (
  label: string,
  m: { started: number; completed: number },
) => `${label}: запускали ${m.started} · прошли до конца ${m.completed}`;

/** Текстовый блок для /stats. Чистая функция. */
export function formatPracticeMetrics(m: PracticeMetrics): string {
  const total =
    m.breathing.started +
    m.breathing.completed +
    m.grounding.completed +
    m.stop.started +
    m.stop.completed;
  const lines = [`🧘 <b>Быстрые практики «Здесь и сейчас»</b> (за месяц)`];
  if (total === 0) {
    lines.push('Пока никто не пробовал');
    return lines.join('\n');
  }
  lines.push(startedAndCompleted('Дыхание', m.breathing));
  lines.push(`Заземление: прошли до конца ${m.grounding.completed}`);
  lines.push(startedAndCompleted('«Стоп»', m.stop));
  lines.push(`Разных людей: ${m.distinctUsers}`);
  return lines.join('\n');
}
