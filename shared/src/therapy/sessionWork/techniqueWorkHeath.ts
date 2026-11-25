import type { HeathTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Хис и Стартап о креативных методах схема-терапии. */
export const HEATH_TECHNIQUE_WORK: Record<HeathTechniqueId, TechniqueWorkDef> =
  {
    creative_mode_work: {
      name: 'Креативная работа с режимами',
      fields: [
        ['mode', 'Какой режим'],
        ['form', 'Форма: рисунок, маска, запись, кукла, игрушки, игра'],
        ['dialogue', 'Что сказали режиму и кто'],
        ['ending', 'Что сделали с режимом в конце'],
      ],
    },
    probe_phrases: {
      name: 'Фразы-зонды',
      fields: [
        ['belief', 'Старое убеждение'],
        ['phrase', 'Фраза-зонд'],
        ['body', 'Что ответило тело'],
        ['home', 'Что взять домой'],
      ],
    },
    intimacy_dialogue: {
      name: 'Диалог близости',
      fields: [
        ['need', 'Уязвимость и просьба'],
        ['coping', 'Копинг слушающего и что он охранял'],
        ['response', 'Ответ партнёра на потребность'],
        ['home', 'Что пробовать дома'],
      ],
    },
  };
