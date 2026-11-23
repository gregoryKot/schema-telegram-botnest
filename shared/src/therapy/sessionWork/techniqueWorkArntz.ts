import type { ArntzTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Арнца и ван Гендерен о ПРЛ. */
export const ARNTZ_TECHNIQUE_WORK: Record<ArntzTechniqueId, TechniqueWorkDef> =
  {
    current_role_play: {
      name: 'Обыгрывание текущей ситуации',
      fields: [
        ['scene', 'Ситуация'],
        ['oldView', 'Прежнее прочтение'],
        ['newView', 'Что стало видно после смены ролей'],
        ['newStep', 'Новый ответ и шаг в жизни'],
      ],
    },
    two_axis_check: {
      name: 'Проверка связи на двух осях',
      fields: [
        ['rule', 'Правило «чем…, тем…»'],
        ['picture', 'Что показал график'],
        ['newView', 'Новый вывод'],
      ],
    },
    need_cycle: {
      name: 'Цикл самонаблюдения',
      fields: [
        ['scene', 'Ситуация'],
        ['mode', 'Схема или режим'],
        ['need', 'Потребность'],
        ['action', 'Что сделано и чем кончилось'],
      ],
    },
    guess_the_mode: {
      name: 'Игра «угадай режим»',
      fields: [
        ['modes', 'Какие режимы угадывали'],
        ['signs', 'По каким признакам узнать'],
      ],
    },
  };
