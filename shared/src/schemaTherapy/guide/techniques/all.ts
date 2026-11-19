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
import { buildOnlineTechniques } from './online';
import { buildBorrowedCbtTechniques } from './borrowedCbt';
import { buildBorrowedDbtTechniques } from './borrowedDbt';
import { buildBorrowedThirdWaveTechniques } from './borrowedThirdWave';
import { buildBorrowedTraumaTechniques } from './borrowedTrauma';

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
  buildOnlineTechniques,
  buildBorrowedCbtTechniques,
  buildBorrowedDbtTechniques,
  buildBorrowedThirdWaveTechniques,
  buildBorrowedTraumaTechniques,
];
