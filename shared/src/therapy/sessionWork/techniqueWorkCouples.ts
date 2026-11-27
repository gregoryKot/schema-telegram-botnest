import type { CouplesTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги о схема-терапии пар. */
export const COUPLES_TECHNIQUE_WORK: Record<
  CouplesTechniqueId,
  TechniqueWorkDef
> = {
  need_vs_wish: {
    name: 'Потребность и желание в паре',
    fields: [
      ['need', 'Потребность каждого, глобально'],
      ['wish', 'Желания: чем сейчас закрывают потребность'],
      ['ask', 'Просьба в сослагательном наклонении'],
      ['next', 'Что решили обсудить дальше'],
    ],
  },
};
