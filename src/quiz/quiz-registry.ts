// Реестр мини-тестов: единственный источник правды для бота (telegram.quiz),
// публичного API (GET /api/quizzes) и санитизации аналитики.
import type { AddressForm } from '../notification/address-form';
import type { Quiz } from './quiz.types';
import { buildDrivesQuiz } from './quiz-drives.data';
import { buildCriticQuiz } from './quiz-critic.data';
import { buildBatteryQuiz } from './quiz-battery.data';

export const QUIZ_IDS = ['drives', 'critic', 'battery'] as const;
export type QuizId = (typeof QUIZ_IDS)[number];

const BUILDERS: Record<QuizId, (form: AddressForm) => Quiz> = {
  drives: buildDrivesQuiz,
  critic: buildCriticQuiz,
  battery: buildBatteryQuiz,
};

export function isQuizId(value: string): value is QuizId {
  return (QUIZ_IDS as readonly string[]).includes(value);
}

export function buildQuizzes(form: AddressForm): Quiz[] {
  return QUIZ_IDS.map((id) => BUILDERS[id](form));
}

export function getQuiz(form: AddressForm, id: string): Quiz | null {
  return isQuizId(id) ? BUILDERS[id](form) : null;
}

/** Все валидные пары «тест → id результата» — для санитизации meta событий. */
export function quizResultIdSet(): ReadonlySet<string> {
  const set = new Set<string>();
  for (const quiz of buildQuizzes('ty')) {
    for (const r of quiz.results) set.add(`${quiz.id}:${r.id}`);
  }
  return set;
}
