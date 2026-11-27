// Полка GUIDE_SOURCES (sources.ts): продолжение sourcesMore.ts и новые книги — файлы полки в храповике размера.
import type { GuideSource } from './sources';
import { MORE_SOURCES as EARLIER } from './sourcesMore';

export const MORE_SOURCES: GuideSource[] = [
  ...EARLIER,
  {
    key: 'Стивенс-Рёдигер',
    author: 'Б. А. Стивенс, Э. Рёдигер',
    title:
      'Breaking Negative Relationship Patterns: A Schema Therapy Self-Help and Support Book, 2017',
  },
];
