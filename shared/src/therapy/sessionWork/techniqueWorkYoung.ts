import type { YoungTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Янга (пачка 8 карты). */
export const YOUNG_TECHNIQUE_WORK: Record<YoungTechniqueId, TechniqueWorkDef> =
  {
    schema_dialogue: {
      name: 'Спор схемы и здоровой стороны',
      fields: [
        ['schema', 'Какая схема'],
        ['arguments', 'Доводы схемы'],
        ['answers', 'Ответы здоровой стороны'],
        ['who', 'Кто говорил за здоровую сторону'],
      ],
    },
  };
