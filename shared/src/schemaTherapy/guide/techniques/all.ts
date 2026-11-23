import type { TechniqueGuideBuilder } from '../types';
import { buildImageryRescriptingTechniques } from './imageryRescripting';
import { buildImageryTechniques } from './imagery';
import { buildChairworkTechniques } from './chairwork';
import { buildChairTechniques } from './chairs';
import { buildRolePlayArntzTechniques } from './rolePlayArntz';
import { buildCognitiveArntzTechniques } from './cognitiveArntz';
import { buildFarrellPlanTechniques } from './farrellPlans';
import { buildEmpathicConfrontationTechniques } from './empathicConfrontation';
import { buildStanceTechniques } from './stance';
import { buildHomeworkTechniques } from './homework';
import { buildPatternBreakingTechniques } from './patternBreaking';
import { buildLimitedReparentingTechniques } from './limitedReparenting';
import { buildRelationshipTechniques } from './relationship';
import { buildImageryMoreTechniques } from './imageryMore';
import { buildImageryModeDialogueTechniques } from './imageryModeDialogue';
import { buildFormulationTechniques } from './formulation';
import { buildEvidenceWorkTechniques } from './evidenceWork';
import { buildChildCareTechniques } from './childCare';
import { buildBodyGroundingTechniques } from './bodyGrounding';
import { buildBodyValuesTechniques } from './bodyValues';
import { buildOnlineTechniques } from './online';
import { buildAttunementNeedsTechniques } from './attunementNeeds';
import { buildMeaningGuiltTechniques } from './meaningGuilt';
import { buildSchemaDialogueTechniques } from './schemaDialogue';
import { buildBorrowedCbtTechniques } from './borrowedCbt';
import { buildBorrowedDbtTechniques } from './borrowedDbt';
import { buildBorrowedThirdWaveTechniques } from './borrowedThirdWave';
import { buildBorrowedTraumaTechniques } from './borrowedTrauma';
import { buildHealthyAdultPlanTechniques } from './healthyAdultPlan';

/** Вся библиотека техник в порядке показа. */
export const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = [
  buildImageryRescriptingTechniques,
  buildImageryTechniques,
  buildChairworkTechniques,
  buildChairTechniques,
  buildRolePlayArntzTechniques,
  buildCognitiveArntzTechniques,
  buildFarrellPlanTechniques,
  buildEmpathicConfrontationTechniques,
  buildStanceTechniques,
  buildHomeworkTechniques,
  buildPatternBreakingTechniques,
  buildLimitedReparentingTechniques,
  buildRelationshipTechniques,
  buildImageryMoreTechniques,
  buildImageryModeDialogueTechniques,
  buildFormulationTechniques,
  buildEvidenceWorkTechniques,
  buildChildCareTechniques,
  buildHealthyAdultPlanTechniques,
  buildBodyGroundingTechniques,
  buildBodyValuesTechniques,
  buildOnlineTechniques,
  buildAttunementNeedsTechniques,
  buildMeaningGuiltTechniques,
  buildSchemaDialogueTechniques,
  buildBorrowedCbtTechniques,
  buildBorrowedDbtTechniques,
  buildBorrowedThirdWaveTechniques,
  buildBorrowedTraumaTechniques,
];
