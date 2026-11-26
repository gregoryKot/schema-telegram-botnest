// Текст для экрана Celebration (стрик-анимация) — единственная копия
// (правило №3 CLAUDE.md, волна 2). Только текстовая логика: сама вёрстка/
// canvas-анимация/стили остаются в components/Celebration.tsx каждого
// фронтенда отдельно (там есть намеренное визуальное расхождение).
export const MILESTONE_TEXT: Record<number, string> = {
  3: 'Хорошее начало — паттерн уже виден',
  7: 'Неделя подряд. Это настоящий сдвиг',
  14: 'Две недели подряд. Паттерн становится стабильным',
  21: '21 день. Тело и ум уже запомнили этот ритм',
  30: 'Месяц. Взгляд на себя меняется',
  60: 'Два месяца подряд. Это уже часть жизни',
  100: '100 дней. Это уже не привычка, а образ жизни',
};

export function pluralDays(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return 'дня';
  return 'дней';
}

export function getMilestoneText(streak: number): string {
  const milestones = [100, 60, 30, 21, 14, 7, 3];
  const hit = milestones.find((m) => streak === m);
  if (hit) return MILESTONE_TEXT[hit];
  return streak === 1
    ? 'Первый день — самый важный'
    : `${streak} ${pluralDays(streak)} подряд`;
}
