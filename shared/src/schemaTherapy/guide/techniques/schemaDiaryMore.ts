import { schemaDiaryFarrell } from './schemaDiaryFarrell';
import { schemaDiaryYoungMore } from './schemaDiaryMoreYoung';
import { schemaDiaryBpd } from './cognitiveWorkBpd';
/** «Подробнее» к технике schema_diary: вынесено, чтобы запись не росла. */
export const schemaDiaryMore: string[] = [
  ...schemaDiaryYoungMore,
  ...schemaDiaryFarrell,
  ...schemaDiaryBpd,
];
