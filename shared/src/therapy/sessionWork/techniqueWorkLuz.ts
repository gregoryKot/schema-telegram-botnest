import type { LuzTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Луз и соавторов о схема-терапии с детьми и подростками. */
export const LUZ_TECHNIQUE_WORK: Record<LuzTechniqueId, TechniqueWorkDef> = {
  child_mode_play: {
    name: 'Режимы в игре с ребёнком',
    fields: [
      ['format', 'Чем играли: куклы, история, фигурки'],
      ['modes', 'Какие режимы появились'],
      ['needs', 'Какие потребности видны'],
      ['next', 'Что перенести в жизнь'],
    ],
  },
  inner_house: {
    name: 'Внутренний дом',
    fields: [
      ['floors', 'Какие этажи собрали'],
      ['modes', 'Какие режимы и их порядок'],
      ['schemes', 'Какие схемы и предметы'],
      ['next', 'К чему вернуться'],
    ],
  },
};
