// Реестр мини-тестов: единственный источник правды для бота (telegram.quiz),
// публичного API (GET /api/quizzes) и санитизации аналитики.
import type { AddressForm } from '../notification/address-form';
import type { Quiz } from './quiz.types';
import { buildDrivesQuiz } from './quiz-drives.data';
import { buildCriticQuiz } from './quiz-critic.data';
import { buildBatteryQuiz } from './quiz-battery.data';
import { buildVoiceQuiz } from './quiz-voice.data';
import { buildAnxietyQuiz } from './quiz-anxiety.data';
import { buildImpostorQuiz } from './quiz-impostor.data';
import { buildPleaserQuiz } from './quiz-pleaser.data';
import { buildBurnoutQuiz } from './quiz-burnout.data';
import { buildProcrastinationQuiz } from './quiz-procrastination.data';
import { buildAttachmentQuiz } from './quiz-attachment.data';
import { buildChemistryQuiz } from './quiz-chemistry.data';
import { buildCopingQuiz } from './quiz-coping.data';
import { buildAngerQuiz } from './quiz-anger.data';
import { buildLonelyQuiz } from './quiz-lonely.data';
import { buildFeelingsQuiz } from './quiz-feelings.data';

export const QUIZ_IDS = [
  'drives',
  'critic',
  'voice',
  'battery',
  'anxiety',
  'impostor',
  'pleaser',
  'burnout',
  'procrastination',
  'attachment',
  'chemistry',
  'coping',
  'anger',
  'lonely',
  'feelings',
] as const;
export type QuizId = (typeof QUIZ_IDS)[number];

const BUILDERS: Record<QuizId, (form: AddressForm) => Quiz> = {
  drives: buildDrivesQuiz,
  critic: buildCriticQuiz,
  voice: buildVoiceQuiz,
  battery: buildBatteryQuiz,
  anxiety: buildAnxietyQuiz,
  impostor: buildImpostorQuiz,
  pleaser: buildPleaserQuiz,
  burnout: buildBurnoutQuiz,
  procrastination: buildProcrastinationQuiz,
  attachment: buildAttachmentQuiz,
  chemistry: buildChemistryQuiz,
  coping: buildCopingQuiz,
  anger: buildAngerQuiz,
  lonely: buildLonelyQuiz,
  feelings: buildFeelingsQuiz,
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
