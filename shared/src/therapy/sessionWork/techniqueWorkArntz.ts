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
  };
