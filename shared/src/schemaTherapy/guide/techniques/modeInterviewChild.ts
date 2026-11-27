import { modeInterviewMoreArntzJacob } from './modeInterviewArntzJacob';
import { modeInterviewChildMore } from './chairworkChild';

export { modeInterviewWhenArntzJacob } from './modeInterviewArntzJacob';

/** «Подробнее» к mode_interview: Арнтц и Якоб, затем дети и подростки (Луз). */
export const modeInterviewMoreArnJacChild: string[] = [
  ...modeInterviewMoreArntzJacob,
  ...modeInterviewChildMore,
];
