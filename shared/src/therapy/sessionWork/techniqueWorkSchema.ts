import type { SchemaTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники схема-терапии, добавленные после первых 14 (#1366). */
export const SCHEMA_TECHNIQUE_WORK: Record<
  SchemaTechniqueId,
  TechniqueWorkDef
> = {
  limited_reparenting: {
    name: 'Ограниченное родительство',
    fields: [
      ['need', 'Какая потребность звучала'],
      ['given', 'Что дал терапевт'],
      ['response', 'Как откликнулся клиент'],
    ],
  },
  limit_setting: {
    name: 'Установление границ',
    fields: [
      ['behavior', 'Что нарушало границу'],
      ['limit', 'Какую границу назвали'],
      ['consequence', 'О каком последствии договорились'],
      ['response', 'Как откликнулся клиент'],
    ],
  },
  diagnostic_imagery: {
    name: 'Диагностическое воображение',
    fields: [
      ['trigger', 'Сегодняшняя ситуация'],
      ['image', 'Детский образ: возраст и сцена'],
      ['need', 'Чего не хватало ребёнку'],
      ['link', 'Как связали с настоящим'],
    ],
  },
  safe_place_imagery: {
    name: 'Безопасное место в воображении',
    fields: [
      ['place', 'Какое место'],
      ['senses', 'Что там видно, слышно, чувствуется'],
      ['result', 'Как изменилось состояние'],
    ],
  },
  mode_dialogue_imagery: {
    name: 'Диалог режимов в воображении',
    fields: [
      ['situation', 'Ситуация'],
      ['modeVoice', 'Что говорил режим'],
      ['adultVoice', 'Что ответил Здоровый Взрослый'],
      ['ending', 'Чем закончилось'],
    ],
  },
  anger_expression: {
    name: 'Выражение гнева',
    fields: [
      ['trigger', 'На что злость'],
      ['expressed', 'Как её выразили'],
      ['need', 'Какая потребность за злостью'],
      ['result', 'Чем закончилось'],
    ],
  },
  mode_map: {
    name: 'Карта режимов',
    fields: [
      ['modes', 'Какие режимы нанесли'],
      ['origins', 'Откуда они'],
      ['insight', 'Что клиент увидел'],
      ['next', 'Что дальше'],
    ],
  },
  schema_diary: {
    name: 'Дневник схем и режимов',
    fields: [
      ['entry', 'Какую запись разбирали'],
      ['schema', 'Схема или режим'],
      ['healthy', 'Здоровый взгляд'],
      ['result', 'Итог'],
    ],
  },
};
