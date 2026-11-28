import type { PracticeNotesBuilder } from './types';
import { buildPracticeModelRoediger } from './practiceModelRoediger';
import { buildPracticeSessionRoediger } from './practiceSessionRoediger';
import { buildPracticeProcessesRoediger } from './practiceProcessesRoediger';

/** «Для терапевта» по Рёдигеру одним куском для practice.ts: полюса потребностей, баланс сессии, шесть процессов, стабилизация. */
export const buildPracticeRoedigerAll: PracticeNotesBuilder = (tr) => [
  ...buildPracticeModelRoediger(tr),
  ...buildPracticeSessionRoediger(tr),
  ...buildPracticeProcessesRoediger(tr),
];
