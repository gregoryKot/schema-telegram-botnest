import type { RoedigerTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Рёдигера, Стивенс и Брокмана о контекстуальной схема-терапии. */
export const ROEDIGER_TECHNIQUE_WORK: Record<
  RoedigerTechniqueId,
  TechniqueWorkDef
> = {
  genogram: {
    name: 'Генограмма',
    fields: [
      ['patterns', 'Что повторяется в поколениях'],
      ['roles', 'Роли, правила, секреты'],
      ['schemas', 'Какие схемы видны'],
      ['next', 'Что дальше'],
    ],
  },
  perspective_change: {
    name: 'Смена точки зрения',
    fields: [
      ['view', 'Что увидели со стороны'],
      ['resource', 'Совет друга или забота о ребёнке'],
      ['self', 'Что клиент сказал себе'],
      ['next', 'Что дальше'],
    ],
  },
};
