import { diagnosticImageryArntzConcept } from './arntzConceptMore';
import { ARNTZ_GENERAL_BY_TECHNIQUE } from './arntzGeneralByTechnique';
import {
  chairworkEatingArntz,
  diagnosticImageryEatingArntz,
} from './eatingTechniquesArntz';

/** «Подробнее» техник по id: гл. 2, 4, 6, 8 Арнтц и Якоб; подключается в allArntz.ts. */
export const ARNTZ_CONCEPT_BY_TECHNIQUE: Record<string, string[]> = {
  ...ARNTZ_GENERAL_BY_TECHNIQUE,
  diagnostic_imagery: [
    ...diagnosticImageryArntzConcept,
    ...diagnosticImageryEatingArntz,
  ],
  chairwork: chairworkEatingArntz,
};
