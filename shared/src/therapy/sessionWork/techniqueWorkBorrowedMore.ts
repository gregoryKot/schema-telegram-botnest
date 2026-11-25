import type { BorrowedTechniqueId } from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: продолжение техник из других подходов — вынесено, чтобы techniqueWorkBorrowed.ts не рос. */
export const BORROWED_TECHNIQUE_WORK_MORE: Pick<
  Record<BorrowedTechniqueId, TechniqueWorkDef>,
  'life_line' | 'downward_arrow' | 'problem_solving'
> = {
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
  problem_solving: {
    name: 'Решение проблем по шагам',
    fields: [
      ['problem', 'Проблема и нужный результат'],
      ['options', 'Варианты решения'],
      ['choice', 'Выбор и почему'],
      ['result', 'Итог и влияние на режимы'],
    ],
  },
};
