import type { PracticeNotesBuilder } from './types';
import { buildPracticeTeen } from './practiceTeen';
import { buildPracticeChildImagery } from './practiceChildImagery';

/** «Для терапевта»: заметки по книге «Луз» (подростки и родители, образы с детьми). */
export const buildPracticeChildren: PracticeNotesBuilder = (tr) => [
  ...buildPracticeTeen(tr),
  ...buildPracticeChildImagery(tr),
];
