// «Мгновенный aha» (аудит 2026-07, этап 4.2): одна фраза-интерпретация
// сегодняшнего профиля потребностей сразу после заполнения трекера — чтобы
// первая сессия давала ощутимую отдачу, а не только обещание «паттерн через
// 3–5 дней». Показывается в Celebration.
//
// ВАЖНО: файл парный (webapp ↔ schema-miniapp) — правки вносить в оба.
// Формулировки нейтральные по обращению (без ты/вы-вилки).

const LABELS: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Границы',
};

/**
 * Возвращает фразу-интерпретацию, либо null, если оценок меньше пяти
 * (celebration в норме срабатывает только при полном заполнении).
 */
export function todayInsightPhrase(
  ratings: Record<string, number | null | undefined>,
): string | null {
  const entries = Object.entries(ratings).filter(
    (e): e is [string, number] => typeof e[1] === 'number',
  );
  if (entries.length < 5) return null;

  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const [weakId, weakVal] = sorted[0];
  const [strongId, strongVal] = sorted[sorted.length - 1];
  const avg =
    Math.round((entries.reduce((s, [, v]) => s + v, 0) / entries.length) * 10) /
    10;

  // Ровный профиль — контраста нет, сравнивать нечего.
  if (strongVal - weakVal <= 1) {
    if (avg >= 7)
      return `Ровный сильный день: все пять потребностей в хорошей зоне (в среднем ${avg}/10).`;
    if (avg <= 4)
      return `Все потребности сегодня просели примерно одинаково — день, когда стоит быть к себе бережнее.`;
    return `Сегодня ровный день: все потребности примерно на одном уровне (${avg}/10).`;
  }

  return `Сегодня опора — ${LABELS[strongId] ?? strongId} (${strongVal}/10), а больше всего внимания просит ${LABELS[weakId] ?? weakId} (${weakVal}/10).`;
}
