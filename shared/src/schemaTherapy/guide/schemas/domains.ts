import type { SchemaDomainGuideBuilder } from '../types';
import { buildRejectionGuides } from './rejection';
import { buildAutonomyGuides } from './autonomy';
import { buildLimitsGuides } from './limits';
import { buildOtherDirectedGuides } from './otherDirected';
import { buildVigilanceGuides } from './vigilance';
import { withChildhood } from './childhood';

/** Домены схем в порядке справочника; к каждой схеме подмешаны вопросы о детстве. */
export const SCHEMA_DOMAIN_BUILDERS: SchemaDomainGuideBuilder[] = [
  buildRejectionGuides,
  buildAutonomyGuides,
  buildLimitsGuides,
  buildOtherDirectedGuides,
  buildVigilanceGuides,
].map((build) => (tr) => withChildhood(build(tr)));
