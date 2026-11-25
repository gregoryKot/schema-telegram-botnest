import type { SchemaGuide } from '../types';

/** Дефективность / Стыд: задания между сессиями (вынесено из rejectionCore.ts). */
export const defectivenessBetweenSessions: SchemaGuide['betweenSessions'] = [
  {
    kind: 'task',
    type: 'belief_check',
    title: 'Проверка убеждения',
    note: 'Мысль «со мной что-то не так» — перед судом фактов',
  },
  {
    kind: 'custom',
    title: 'Список положительных посланий',
    text: 'Собрать тёплые слова, которые когда-либо говорили близкие, друзья, учителя, терапевт. Добавлять по одному пункту в день. Перечитывать вслух, когда Критик звучит громче обычного.',
  },
];
