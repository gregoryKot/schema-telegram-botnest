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
    trauma_map: {
      name: 'Карта травмы',
      fields: [
        ['events', 'События на карте'],
        ['meaning', 'Реакции и смыслы, что их связывает'],
        ['schemas', 'Схемы, копинг и цели Здорового Взрослого'],
        ['first', 'С чего начнём рескриптинг'],
      ],
    },
    recent_event_imagery: {
      name: 'Рескриптинг недавнего события',
      fields: [
        ['scene', 'Сцена'],
        ['modes', 'Какие режимы и где стоят в образе'],
        ['adult', 'Что сказал Здоровый Взрослый'],
        ['after', 'Что изменилось'],
      ],
    },
    mental_contrasting_imagery: {
      name: 'Ментальный контраст и «если — тогда»',
      fields: [
        ['goal', 'Желанный шаг'],
        ['obstacle', 'Препятствия и режим за ними'],
        ['plan', 'Фразы «если — тогда»'],
        ['step', 'Шаг на неделю'],
      ],
    },
    three_parts_check_in: {
      name: 'Медитация на три части',
      fields: [
        ['vulnerable', 'Что нужно Уязвимому Ребёнку'],
        ['happy', 'Чему радуется Счастливый Ребёнок'],
        ['adult', 'Что ценно Здоровому Взрослому'],
        ['after', 'Что осталось после'],
      ],
    },
  };
