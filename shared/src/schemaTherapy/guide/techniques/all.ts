import type { TechniqueGuideBuilder } from '../types';
import { buildImageryTechniques } from './imagery';
import { buildChairTechniques } from './chairs';
import { buildStanceTechniques } from './stance';
import { buildHomeworkTechniques } from './homework';
import { buildRelationshipTechniques } from './relationship';
import { buildImageryMoreTechniques } from './imageryMore';
import { buildFormulationTechniques } from './formulation';
import { buildEvidenceWorkTechniques } from './evidenceWork';
import { buildChildCareTechniques } from './childCare';
import { buildBodyValuesTechniques } from './bodyValues';

/** Вся библиотека техник в порядке показа. */
export const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = [
  buildImageryTechniques,
  buildChairTechniques,
  buildStanceTechniques,
  buildHomeworkTechniques,
  buildRelationshipTechniques,
  buildImageryMoreTechniques,
  buildFormulationTechniques,
  buildEvidenceWorkTechniques,
  buildChildCareTechniques,
  buildBodyValuesTechniques,
];
