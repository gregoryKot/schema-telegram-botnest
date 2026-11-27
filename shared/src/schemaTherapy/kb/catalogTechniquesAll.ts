import { type CatalogTopic } from './catalogMindfulness';
import { WRITTEN_TECHNIQUES_MORE } from './catalogTechniquesMore';

/** Техники библиотеки сверх основного списка: written и planned из недавних книг (catalogTechniques.ts в храповике размера). */
export const MORE_TECHNIQUES: readonly CatalogTopic[] = [
  ...WRITTEN_TECHNIQUES_MORE,
  {
    id: 'emotional_learning_inquiry',
    title: 'Эмоциональное обучение: завершение предложения и вопросы Экера',
    status: 'planned',
    source: 'Стивенс-Рёдигер',
    chapters: ['гл. 16'],
  },
];
