import { schemaDiaryFarrell } from './schemaDiaryFarrell';
import { schemaDiaryYoungMore } from './schemaDiaryMoreYoung';
/** «Подробнее» к технике schema_diary: вынесено, чтобы запись не росла. */
export const schemaDiaryMore: string[] = [
  'Графы бланка Янга: триггер, эмоции, мысли, поведение, схемы, здоровый взгляд, реальные опасения, преувеличения, здоровое поведение.',
  'Поддержка меняется по фазам: в начале схемы и режимы в записях называет терапевт, к середине и концу клиент заполняет дневник сам [Кембридж, гл. 7].',
  ...schemaDiaryYoungMore,
  ...schemaDiaryFarrell,
];
