import type { VreeswijkTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги ван Фресвайк, Брурсен и Шуринк об осознанности в схема-терапии. */
export const VREESWIJK_TECHNIQUE_WORK: Record<
  VreeswijkTechniqueId,
  TechniqueWorkDef
> = {
  three_minute_breathing_space: {
    name: 'Трёхминутная пауза',
    fields: [
      ['moment', 'Когда сработал паттерн'],
      ['noticed', 'Что было замечено'],
      ['choice', 'Какой выбор после паузы'],
    ],
  },
  mindfulness_practices: {
    name: 'Практики осознанности',
    fields: [
      ['practice', 'Какая практика'],
      ['noticed', 'Что замечено в теле и мыслях'],
      ['schemas', 'Какие схемы и режимы включились'],
      ['home', 'Практика между сессиями'],
    ],
  },
  schema_awareness_practice: {
    name: 'Осознанность к схеме',
    fields: [
      ['schema', 'Какая схема или режим узнаны'],
      ['signal', 'По какому чувству и телу'],
      ['counter', 'Что противоречит схеме'],
      ['statements', 'Принимающие утверждения'],
    ],
  },
  healthy_modes_mindfulness: {
    name: 'Осознанность к здоровым режимам',
    fields: [
      ['variant', 'Какой вариант практики'],
      ['body', 'Где в теле ощущались режимы'],
      ['needs', 'Что и кто нужны режимам'],
      ['home', 'Практика между сессиями'],
    ],
  },
};
