import type { CouplesTechniqueId } from '../../schemaTherapy/guide/techniqueIdsCouples';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги о схема-терапии пар. */
export const COUPLES_TECHNIQUE_WORK: Record<
  CouplesTechniqueId,
  TechniqueWorkDef
> = {
  mutual_reparenting: {
    name: 'Взаимный репарентинг пары',
    fields: [
      ['situation', 'Ссора или ситуация'],
      ['child', 'Что нужно Уязвимому Ребёнку'],
      ['reply', 'Как ответил партнёр'],
      ['next', 'Что пробуют дома'],
    ],
  },
  couple_friendship: {
    name: 'Дружба пары',
    fields: [
      ['practice', 'Что делали: признание, примирение, заботливое поведение'],
      ['agreement', 'О чём договорились'],
      ['response', 'Как отозвалось'],
      ['home', 'Что до следующей встречи'],
    ],
  },
};
