import type { PracticeNotesBuilder } from './types';
import { buildPracticeHealthyAdultRoediger } from './practiceHealthyAdultRoediger';
import { buildPracticeStabilizationRoediger } from './practiceStabilizationRoediger';

/** «Для терапевта» по Рёдигеру: шесть процессов (гл. 4, 7) и стабилизация (гл. 12). Собирает practiceRoedigerAll.ts. */
export const buildPracticeProcessesRoediger: PracticeNotesBuilder = (tr) => [
  ...buildPracticeHealthyAdultRoediger(tr),
  ...buildPracticeStabilizationRoediger(tr),
];
