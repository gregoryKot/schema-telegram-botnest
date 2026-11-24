import type { BorrowedTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из других подходов (#1366). */
export const BORROWED_TECHNIQUE_WORK: Record<
  BorrowedTechniqueId,
  TechniqueWorkDef
> = {
  behavioral_activation: {
    name: 'Поведенческая активация',
    fields: [
      ['monitoring', 'Что показала запись недели'],
      ['activities', 'Какие занятия выбрали'],
      ['obstacle', 'Что может помешать'],
      ['result', 'Итог'],
    ],
  },
  socratic_dialogue: {
    name: 'Сократический диалог',
    fields: [
      ['belief', 'Убеждение'],
      ['questions', 'О чём спрашивали'],
      ['summary', 'Что собрали'],
      ['conclusion', 'Вывод клиента'],
    ],
  },
  exposure: {
    name: 'Экспозиция',
    fields: [
      ['target', 'Чего избегает клиент'],
      ['prediction', 'Какое было ожидание'],
      ['step', 'Какой шаг сделали'],
      ['outcome', 'Что вышло'],
    ],
  },
  chain_analysis: {
    name: 'Цепочный анализ',
    fields: [
      ['behavior', 'Поведение'],
      ['trigger', 'Толчок и уязвимость'],
      ['links', 'Звенья'],
      ['alternative', 'Где можно иначе'],
    ],
  },
  distress_tolerance: {
    name: 'Переносимость дистресса',
    fields: [
      ['situation', 'Ситуация'],
      ['skills', 'Какие навыки отобрали'],
      ['opposite', 'Противоположное действие'],
      ['result', 'Итог'],
    ],
  },
  validation_levels: {
    name: 'Валидация',
    fields: [
      ['feeling', 'Что валидировали'],
      ['level', 'Как именно'],
      ['response', 'Как откликнулся клиент'],
    ],
  },
  defusion: {
    name: 'Дефузия',
    fields: [
      ['thought', 'Мысль'],
      ['exercise', 'Какое упражнение'],
      ['noticed', 'Что изменилось'],
      ['action', 'Шаг по ценностям'],
    ],
  },
  compassionate_self: {
    name: 'Сострадательное «я»',
    fields: [
      ['situation', 'Ситуация'],
      ['image', 'Образ сострадательного «я»'],
      ['message', 'Что оно сказало'],
      ['practice', 'Практика дома'],
    ],
  },
  motivational_interviewing: {
    name: 'Мотивационное интервью',
    fields: [
      ['focus', 'О каком изменении'],
      ['changeTalk', 'Доводы клиента за'],
      ['doubts', 'Сомнения'],
      ['plan', 'Шаг, который назвал клиент'],
    ],
  },
  window_of_tolerance: {
    name: 'Окно толерантности',
    fields: [
      ['signsUp', 'Признаки выхода вверх'],
      ['signsDown', 'Признаки выхода вниз'],
      ['returns', 'Что возвращает в окно'],
    ],
  },
  stop_rewind_explore: {
    name: 'Стоп, перемотка, исследование',
    fields: [
      ['moment', 'Где остановились'],
      ['rewind', 'К чему вернулись'],
      ['explored', 'Что выяснили'],
      ['result', 'Итог'],
    ],
  },
  life_line: {
    name: 'Линия жизни',
    fields: [
      ['stones', 'Камни'],
      ['flowers', 'Цветы'],
      ['noticed', 'Что клиент увидел'],
      ['next', 'Что дальше'],
    ],
  },
  downward_arrow: {
    name: 'Нисходящая стрела',
    fields: [
      ['thought', 'Исходная мысль'],
      ['bottom', 'Вывод на дне'],
      ['schema', 'Какая схема'],
    ],
  },
};
