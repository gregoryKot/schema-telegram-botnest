import type { CouplesTechniqueId } from '../../schemaTherapy/guide/techniqueIdsCouples';
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
  couple_chairwork: {
    name: 'Стулья в паре',
    fields: [
      ['modes', 'Какие режимы были на стульях'],
      ['view', 'Что увидели со стороны'],
      ['need', 'Что нужно каждому'],
    ],
  },
};
