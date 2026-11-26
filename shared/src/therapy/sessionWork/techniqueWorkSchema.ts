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
  positive_data_log: {
    name: 'Журнал позитивных данных',
    fields: [
      ['belief', 'Какое убеждение укрепляем'],
      ['facts', 'Какие факты записали'],
      ['scale', 'Что показала шкала'],
      ['result', 'Итог'],
    ],
  },
  behavioral_experiment: {
    name: 'Поведенческий эксперимент',
    fields: [
      ['prediction', 'Предсказание'],
      ['test', 'Как проверяем'],
      ['outcome', 'Что вышло'],
      ['conclusion', 'Вывод'],
    ],
  },
  transitional_objects: {
    name: 'Переходный объект',
    fields: [
      ['object', 'Что это'],
      ['message', 'Что на нём или в записи'],
      ['when', 'Когда доставать'],
    ],
  },
  play_and_joy: {
    name: 'Игра и радость',
    fields: [
      ['activity', 'Во что играли'],
      ['blocker', 'Какой режим мешал'],
      ['response', 'Как откликнулся клиент'],
      ['plan', 'Что между сессиями'],
    ],
  },
  body_grounding: {
    name: 'Работа с телом',
    fields: [
      ['noticed', 'Что заметили в теле'],
      ['mode', 'Какой режим за этим'],
      ['grounding', 'Как заземлялись'],
      ['result', 'Как изменилось состояние'],
    ],
  },
  values_overview: {
    name: 'Ценности и «взгляд сверху»',
    fields: [
      ['situation', 'Ситуация'],
      ['values', 'Что важно'],
      ['step', 'Шаг на неделю'],
      ['obstacle', 'Какой режим помешает'],
    ],
  },
  couple_mode_cycle: {
    name: 'Цикл режимов в паре',
    fields: [
      ['conflict', 'Ссора'],
      ['cycle', 'Как идёт круг'],
      ['needs', 'Что нужно каждому'],
      ['exit', 'Как выходим'],
    ],
  },
  online_chairwork: {
    name: 'Стулья онлайн',
    fields: [
      ['variant', 'Где стояли стулья'],
      ['modes', 'Какие режимы говорили'],
      ['result', 'Как изменилось состояние'],
    ],
  },
};
