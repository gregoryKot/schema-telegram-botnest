import type { CambridgeTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из Кембриджского руководства (пачка 7 карты). */
export const CAMBRIDGE_TECHNIQUE_WORK: Record<
  CambridgeTechniqueId,
  TechniqueWorkDef
> = {
  schema_attunement: {
    name: 'Подстройка к схеме',
    fields: [
      ['moment', 'Момент триггера'],
      ['feeling', 'Чувство и тело'],
      ['schema', 'Схема и потребность'],
      ['bridge', 'К какой работе перешли'],
    ],
  },
  responsibility_pie: {
    name: 'Диаграмма ответственности',
    fields: [
      ['belief', 'Убеждение и вера до'],
      ['causes', 'Другие причины'],
      ['share', 'Доля клиента и вера после'],
    ],
  },
  courtroom: {
    name: 'Суд',
    fields: [
      ['charge', 'Обвинение'],
      ['defence', 'Доводы защиты'],
      ['verdict', 'Приговор'],
    ],
  },
  healthy_adult_three_chairs: {
    name: 'Три стула Здорового Взрослого',
    fields: [
      ['situation', 'Ситуация'],
      ['compassion', 'Сочувствие'],
      ['reframe', 'Ответ Критику или копингу'],
      ['action', 'Новое поведение'],
    ],
  },
  need_now_question: {
    name: 'Вопрос «Чего я хочу сейчас?»',
    fields: [
      ['need', 'Какое желание нашлось'],
      ['done', 'Что сделали на сессии'],
      ['mood', 'Что изменилось'],
    ],
  },
};
