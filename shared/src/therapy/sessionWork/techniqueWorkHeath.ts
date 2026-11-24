import type { HeathTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Хис и Стартап о креативных методах схема-терапии. */
export const HEATH_TECHNIQUE_WORK: Record<HeathTechniqueId, TechniqueWorkDef> =
  {
    probe_phrases: {
      name: 'Фразы-зонды',
      fields: [
        ['belief', 'Старое убеждение'],
        ['phrase', 'Фраза-зонд'],
        ['body', 'Что ответило тело'],
        ['home', 'Что взять домой'],
      ],
    },
  };
