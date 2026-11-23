import type { FarrellTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Фаррелл, Рейсс и Шоу о групповой схема-терапии. */
export const FARRELL_TECHNIQUE_WORK: Record<
  FarrellTechniqueId,
  TechniqueWorkDef
> = {
  healthy_adult_plan: {
    name: 'План Здорового Взрослого',
    fields: [
      ['scene', 'Режим и ситуация'],
      ['goodParent', 'Взгляд Хорошего Родителя'],
      ['plan', 'План и навыки'],
      ['result', 'Сработал ли план'],
    ],
  },
  safety_bubble: {
    name: 'Пузырь безопасности',
    fields: [
      ['image', 'Какой образ защиты'],
      ['effect', 'Что изменилось в теле и чувствах'],
      ['home', 'Как практиковать дома'],
    ],
  },
};
