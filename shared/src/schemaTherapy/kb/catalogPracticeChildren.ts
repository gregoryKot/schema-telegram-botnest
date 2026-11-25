// Каталог «Для терапевта»: темы книги «Луз» (дети и подростки), карта — docs/guide-sources/Дети.md.
import type { CatalogTopic } from './catalog';
import { PRACTICE_CATALOG } from './catalogPractice';

export const PRACTICE_CATALOG_CHILDREN: readonly CatalogTopic[] = [
  {
    id: 'parent_work',
    title: 'Работа с родителями: коучинг, их схемы, вина',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 15', 'гл. 16', 'гл. 17'],
  },
  {
    id: 'parent_child_collusion',
    title: 'Коллюзия схем родителя и ребёнка, функция симптома',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 5', 'гл. 15'],
  },
  {
    id: 'school_work',
    title: 'Школа: трудности обучения, травля, отказ от школы',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 6'],
  },
  {
    id: 'child_imagery_precautions',
    title: 'Образы с детьми: готовность, противопоказания',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 13'],
  },
  {
    id: 'child_group',
    title: 'Группа для детей и подростков',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 18'],
  },
  {
    id: 'teen_parent_triangle',
    title: 'Терапевт между подростком и родителем',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 7', 'гл. 8', 'гл. 9'],
  },
];

/** Весь каталог «Для терапевта»: общий плюс темы книги «Луз». */
export const PRACTICE_CATALOG_ALL: readonly CatalogTopic[] = [
  ...PRACTICE_CATALOG,
  ...PRACTICE_CATALOG_CHILDREN,
];
