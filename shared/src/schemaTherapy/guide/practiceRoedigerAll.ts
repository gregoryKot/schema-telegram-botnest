import type { PracticeNotesBuilder } from './types';
import { buildPracticeModelRoediger } from './practiceModelRoediger';
import { buildPracticeSessionRoediger } from './practiceSessionRoediger';
import { buildPracticeHealthyAdultRoediger } from './practiceHealthyAdultRoediger';

/** «Для терапевта» по Рёдигеру одним куском для practice.ts: полюса потребностей, баланс сессии, шесть процессов. */
export const buildPracticeRoedigerAll: PracticeNotesBuilder = (tr) => [
  ...buildPracticeModelRoediger(tr),
  ...buildPracticeSessionRoediger(tr),
  ...buildPracticeHealthyAdultRoediger(tr),
];
