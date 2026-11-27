import type { TechniqueGuideBuilder } from '../types';
import { buildBorrowedDbtTechniques as buildDbtBase } from './borrowedDbt';
import { patchTechnique } from './patchTechniqueRoedigerSkills';

const dbtSteps = [
  'Сильное ощущение, чтобы вернуться в тело [Рёдигер, гл. 11]. Кубики льда таят в руке, резинка на запястье или колючий массажный мячик. Всё, что может ранить или повредить кожу, исключить.',
  'Телесный приём без вреда [Рёдигер, гл. 11]. Удлинённый выдох: вдох на четыре счёта, выдох на восемь, либо четыре-четыре-четыре с задержкой. Или присесть спиной к стене с согнутыми коленями хотя бы на 30 секунд, потом вернуться к делу.',
];

/** Из ДБТ: переносимость дистресса пополнена телесными приёмами (Рёдигер, гл. 11). */
export const buildBorrowedDbtTechniques: TechniqueGuideBuilder = (tr) =>
  patchTechnique(buildDbtBase(tr), 'distress_tolerance', (t) => ({
    steps: [t.steps[0], ...dbtSteps, ...t.steps.slice(1)],
  }));
