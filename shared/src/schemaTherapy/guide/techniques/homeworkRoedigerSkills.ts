import type { TechniqueGuideBuilder } from '../types';
import { buildHomeworkTechniques as buildHomeworkBase } from './homework';
import { buildModeDiaryToolsTechniques } from './modeDiaryToolsRoedigerSkills';
import { patchTechnique } from './patchTechniqueRoedigerSkills';
import { buildSelfRegulationToolkitTechniques } from './selfRegulationToolkitRoedigerSkills';

const lettersMore =
  'Письма без отправки [Рёдигер, гл. 11]. Если письмо о чувствах к обидчику, его читают на сессии, а потом клиент может сжечь: ритуал помогает отпустить обиду и горечь. Как приём саморегуляции письмо входит и в набор навыков.';

/** Домашние задания: письма без отправки; плюс набор навыков регуляции и дневники режимов (Рёдигер, гл. 11). */
export const buildHomeworkTechniques: TechniqueGuideBuilder = (tr) => [
  ...patchTechnique(buildHomeworkBase(tr), 'letters', (t) => ({
    more: [...(t.more ?? []), lettersMore],
  })),
  ...buildSelfRegulationToolkitTechniques(tr),
  ...buildModeDiaryToolsTechniques(tr),
];
