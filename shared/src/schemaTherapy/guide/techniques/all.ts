import type { TechniqueGuideBuilder } from '../types';
import { buildImageryRescriptingTechniques } from './imageryRescripting';
import { buildImageryTechniques } from './imagery';
import { buildChairworkTechniques } from './chairwork';
import { buildChairTechniques } from './chairs';
import { buildStanceTechniques } from './stance';
import { buildHomeworkTechniques } from './homework';
import { buildRelationshipTechniques } from './relationship';
import { buildImageryMoreTechniques } from './imageryMore';
import { buildImageryModeDialogueTechniques } from './imageryModeDialogue';
import { buildFormulationTechniques } from './formulation';
import { buildEvidenceWorkTechniques } from './evidenceWork';
import { buildChildCareTechniques } from './childCare';
import { buildBodyValuesTechniques } from './bodyValues';
import { buildOnlineTechniques } from './online';
import { buildAttunementNeedsTechniques } from './attunementNeeds';
import { buildMeaningGuiltTechniques } from './meaningGuilt';
import { buildBorrowedCbtTechniques } from './borrowedCbt';
import { buildBorrowedDbtTechniques } from './borrowedDbt';
import { buildBorrowedThirdWaveTechniques } from './borrowedThirdWave';
import { buildBorrowedTraumaTechniques } from './borrowedTrauma';

/** Вся библиотека техник в порядке показа. */
export const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = [
  buildImageryRescriptingTechniques,
  buildImageryTechniques,
  buildChairworkTechniques,
  buildChairTechniques,
  buildStanceTechniques,
  buildHomeworkTechniques,
  buildRelationshipTechniques,
  buildImageryMoreTechniques,
  buildImageryModeDialogueTechniques,
  buildFormulationTechniques,
  buildEvidenceWorkTechniques,
  buildChildCareTechniques,
  buildBodyValuesTechniques,
  buildOnlineTechniques,
  buildAttunementNeedsTechniques,
  buildMeaningGuiltTechniques,
  buildBorrowedCbtTechniques,
  buildBorrowedDbtTechniques,
  buildBorrowedThirdWaveTechniques,
  buildBorrowedTraumaTechniques,
];
