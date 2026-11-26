import { bpdRelationshipRafaeli } from './bpdRafaeli';
import { BPD_RELATIONSHIP } from './bpdRelationshipItems';
import { BPD_SECTIONS } from './bpdSections';
import type { ConcernGuide } from './types';

/** Все разделы `bpd` после сути и критериев: BPD_SECTIONS и отношения. */
export const BPD_ALL_SECTIONS: Pick<
  ConcernGuide,
  | 'modeModel'
  | 'inSession'
  | 'course'
  | 'crisis'
  | 'stuck'
  | 'evidence'
  | 'relationship'
> = {
  ...BPD_SECTIONS,
  relationship: [...BPD_RELATIONSHIP, ...bpdRelationshipRafaeli],
};
