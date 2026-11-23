import type { FarrellTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Фаррелл, Рейсс и Шоу о групповой схема-терапии. */
export const FARRELL_TECHNIQUE_WORK: Record<
  FarrellTechniqueId,
  TechniqueWorkDef
> = {
  safety_bubble: {
    name: 'Пузырь безопасности',
    fields: [
      ['image', 'Какой образ защиты'],
      ['effect', 'Что изменилось в теле и чувствах'],
      ['home', 'Как практиковать дома'],
    ],
  },
};
