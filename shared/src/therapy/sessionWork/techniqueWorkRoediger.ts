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
  body_mode_positions: {
    name: 'Тело и место терапевта',
    fields: [
      ['position', 'Где сидели или стояли'],
      ['body', 'Что заметили в теле'],
      ['mode', 'Какой режим открылся'],
      ['next', 'Что дальше'],
    ],
  },
  farewell_imagery: {
    name: 'Образ прощания с умершим',
    fields: [
      ['said', 'Что клиент сказал умершему'],
      ['modes', 'Какие режимы собрались вокруг горя'],
      ['reply', 'Что ответил умерший и как это отозвалось'],
      ['next', 'Что дальше'],
    ],
  },
  emotional_resonance_sphere: {
    name: 'Сфера эмоционального резонанса',
    fields: [
      ['scene', 'Сцена-триггер'],
      ['reaction', 'Какая защитная реакция проявилась'],
      ['suds', 'Напряжение до и после'],
      ['lesson', 'Решение и урок'],
    ],
  },
  self_regulation_toolkit: {
    name: 'Набор навыков регуляции',
    fields: [
      ['skills', 'Какие приёмы в иерархии'],
      ['suds', 'Напряжение до и после каждого'],
      ['worked', 'Что сработало'],
      ['next', 'Что дальше'],
    ],
  },
  mode_diary_tools: {
    name: 'Дневники режимов',
    fields: [
      ['form', 'Какая форма дневника'],
      ['seen', 'Что клиент заметил в режимах'],
      ['stuck', 'Где застрял'],
      ['next', 'Что дальше'],
    ],
  },
};
