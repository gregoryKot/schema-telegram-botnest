import type { ArntzJacobTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Арнтц и Якоб «Практическое руководство по схема-терапии». */
export const ARNTZ_JACOB_TECHNIQUE_WORK: Record<
  ArntzJacobTechniqueId,
  TechniqueWorkDef
> = {
  coping_bypass: {
    name: 'Прямой обход копинга',
    fields: [
      ['mode', 'Какой копинг включился'],
      ['trigger', 'Что его включило'],
      ['feeling', 'Чувство и режим за ним'],
      ['next', 'С чем работали дальше'],
    ],
  },
  mode_figures: {
    name: 'Режимы фигурками',
    fields: [
      ['mode', 'Какой режим заслонял Ребёнка'],
      ['feeling', 'Что клиент узнал в расстановке'],
      ['next', 'С чем работали дальше'],
    ],
  },
};
