import type { FarrellTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Фаррелл, Рейсс и Шоу. */
export const FARRELL_TECHNIQUE_WORK: Record<
  FarrellTechniqueId,
  TechniqueWorkDef
> = {
  mode_management_plan: {
    name: 'План управления режимами',
    fields: [
      ['mode', 'Режим'],
      ['now', 'Приёмы на сейчас'],
      ['later', 'Приёмы надолго'],
      ['schema', 'Связанная схема'],
    ],
  },
};
