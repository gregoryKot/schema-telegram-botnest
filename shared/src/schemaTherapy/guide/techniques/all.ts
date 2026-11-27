import type { TechniqueGuideBuilder } from '../types';
import { buildImageryRescriptingTechniques } from './imageryRescripting';
import { buildImageryTechniques } from './imagery';
import { buildChairworkTechniques } from './chairwork';
import { buildChairTechniques } from './chairs';
import { buildCreativeModeWorkTechniques } from './creativeModeWork';
import { buildRolePlayArntzTechniques } from './rolePlayArntz';
import { buildCognitiveArntzTechniques } from './cognitiveArntz';
import { buildFarrellPlanTechniques } from './farrellPlans';
import { buildFarrellShawMonitoringTechniques } from './farrellShawMonitoring';
import { buildStoryUnmetNeedTechniques } from './storyUnmetNeed';
import { buildEmpathicConfrontationTechniques } from './empathicConfrontation';
import { buildStanceTechniques } from './stance';
import { buildHomeworkTechniques } from './homework';
import { buildPatternBreakingTechniques } from './patternBreaking';
import { buildLimitedReparentingTechniques } from './limitedReparenting';
import { buildRelationshipTechniques } from './relationship';
import { buildImageryMoreTechniques } from './imageryMore';
import { buildSafetyBubbleTechniques } from './safetyBubble';
import { buildProbePhrasesTechniques } from './probePhrases';
import { buildIntimacyDialogueTechniques } from './intimacyDialogue';
import { buildTraumaMapTechniques } from './traumaMap';
import { buildImageryRecentTechniques } from './imageryRecent';
import { buildThreePartsCheckInTechniques } from './threePartsCheckIn';
import { buildCopingBypassTechniques } from './copingBypass';
import { buildModeFiguresTechniques } from './modeFigures';
import { buildImageryModeDialogueTechniques } from './imageryModeDialogue';
import { buildFormulationTechniques } from './formulation';
import { buildEvidenceWorkTechniques } from './evidenceWork';
import { buildEvidenceLifeReviewTechniques } from './evidenceLifeReview';
import { buildRuptureRepairTechniques } from './ruptureRepair';
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
import { buildGenogramTechniques } from './genogram';
import { buildChildModePlayTechniques } from './childModePlay';
import { buildPerspectiveChangeTechniques } from './perspectiveChange';
import { buildBodyModePositionsTechniques } from './bodyModePositions';
import { buildMindfulnessPracticesTechniques } from './mindfulnessPractices';
import { buildSchemaAwarenessTechniques } from './schemaAwareness';
import { buildHealthyModesMindfulnessTechniques } from './healthyModesMindfulness';

/** Вся библиотека техник в порядке показа. */
export const TECHNIQUE_BUILDERS: TechniqueGuideBuilder[] = [
  buildImageryRescriptingTechniques,
  buildImageryTechniques,
  buildChairworkTechniques,
  buildChairTechniques,
  buildCreativeModeWorkTechniques,
  buildRolePlayArntzTechniques,
  buildCognitiveArntzTechniques,
  buildFarrellPlanTechniques,
  buildFarrellShawMonitoringTechniques,
  buildEmpathicConfrontationTechniques,
  buildCopingBypassTechniques,
  buildModeFiguresTechniques,
  buildStanceTechniques,
  buildMindfulnessPracticesTechniques,
  buildSchemaAwarenessTechniques,
  buildHealthyModesMindfulnessTechniques,
  buildHomeworkTechniques,
  buildPatternBreakingTechniques,
  buildLimitedReparentingTechniques,
  buildRelationshipTechniques,
  buildImageryMoreTechniques,
  buildStoryUnmetNeedTechniques,
  buildSafetyBubbleTechniques,
  buildImageryModeDialogueTechniques,
  buildFormulationTechniques,
  buildGenogramTechniques,
  buildChildModePlayTechniques,
  buildPerspectiveChangeTechniques,
  buildBodyModePositionsTechniques,
  buildEvidenceWorkTechniques,
  buildEvidenceLifeReviewTechniques,
  buildRuptureRepairTechniques,
  buildChildCareTechniques,
  buildHealthyAdultPlanTechniques,
  buildBodyGroundingTechniques,
  buildProbePhrasesTechniques,
  buildThreePartsCheckInTechniques,
  buildBodyValuesTechniques,
  buildIntimacyDialogueTechniques,
  buildTraumaMapTechniques,
  buildImageryRecentTechniques,
  buildOnlineTechniques,
  buildAttunementNeedsTechniques,
  buildMeaningGuiltTechniques,
  buildSchemaDialogueTechniques,
  buildBorrowedCbtTechniques,
  buildBorrowedDbtTechniques,
  buildBorrowedThirdWaveTechniques,
  buildBorrowedTraumaTechniques,
];
