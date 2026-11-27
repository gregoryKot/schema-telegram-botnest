import type { PracticeNotesBuilder, TechniqueGuideBuilder } from './types';
import { buildCreativeModeWorkTechniques as baseTechniques } from './techniques/creativeModeWork';
import { buildPracticeYoungSession as basePractice } from './practiceYoungSession';

const withLuz = <T extends { id: string; sources: string }>(
  items: T[],
  id: string,
  mark: string,
): T[] =>
  items.map((x) =>
    x.id === id ? { ...x, sources: `${x.sources}, ${mark}` } : x,
  );

/** creative_mode_work с меткой книги Луз: основной файл записи не растёт. */
export const buildCreativeModeWorkWithLuz: TechniqueGuideBuilder = (tr) =>
  withLuz(baseTechniques(tr), 'creative_mode_work', '[Луз, гл. 12]');

/** mode_work_steps с меткой книги Луз: основной файл записи не растёт. */
export const buildPracticeYoungSessionWithLuz: PracticeNotesBuilder = (tr) =>
  withLuz(basePractice(tr), 'mode_work_steps', '[Луз, гл. 12]');
