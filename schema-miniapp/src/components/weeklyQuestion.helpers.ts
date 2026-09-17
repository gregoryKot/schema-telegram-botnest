// Чистая логика «Вопроса недели» — вынесено из WeeklyQuestion.tsx
// (правило №10, файл был у потолка).
const buildQuestions = (tr: (ty: string, vy: string) => string) => [
  'Что было самым трудным на этой неделе?',
  tr(
    'Что дало тебе энергию на этой неделе?',
    'Что дало вам энергию на этой неделе?',
  ),
  tr(
    'Было ли что-то, что получилось именно так, как ты хочешь — не потому что нужно или ждут?',
    'Было ли что-то, что получилось именно так, как вы хотите — не потому что нужно или ждут?',
  ),
  tr('Что хотелось бы сделать иначе?', 'Что вы хотели бы сделать иначе?'),
  'Что хочется взять с собой в следующую неделю?',
  tr(
    'В чём была твоя забота о себе на этой неделе?',
    'В чём была ваша забота о себе на этой неделе?',
  ),
  tr('Что нового ты замечаешь о себе?', 'Что нового вы замечаете о себе?'),
  'Какая потребность требовала больше всего внимания?',
];

export function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7,
  );
  return `weekly_q_${now.getFullYear()}_${week}`;
}

export function getQuestion(tr: (ty: string, vy: string) => string): string {
  const now = new Date();
  const week = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000,
  );
  const questions = buildQuestions(tr);
  return questions[week % questions.length];
}

export function shouldShow(): boolean {
  if (localStorage.getItem(getWeekKey())) return false;
  const dow = new Date().getDay(); // 1 = Monday
  return dow === 1;
}
