import type { PracticeNotesBuilder } from './types';
import { buildPracticeDangerous } from './practiceDangerous';
import { buildPracticeCouplesTherapist } from './practiceCouplesTherapist';

/** Опасный партнёр клиента и безопасность терапевта пары рядом: собирает practiceSituations.ts. */
export const buildPracticeDangerousAll: PracticeNotesBuilder = (tr) => [
  ...buildPracticeDangerous(tr),
  ...buildPracticeCouplesTherapist(tr),
];
