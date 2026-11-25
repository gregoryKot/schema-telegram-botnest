import {
  avoidanceArntzConcept,
  surrenderArntzConcept,
} from './arntzConceptMore';

/** Образцы гл. 2.1.3 «Подробнее» к режимам избегания и капитуляции; id — режимы с этими образцами. */
export const CONCEPT: Record<string, string[]> = {
  avoidant_protector: avoidanceArntzConcept,
  angry_protector: avoidanceArntzConcept,
  compliant_surrenderer: surrenderArntzConcept,
  helpless_surrenderer: surrenderArntzConcept,
};
