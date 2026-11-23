// Каталог-цель вкладки «Запросы и расстройства» (kb/catalog.ts): что должно быть по литературе.
// Черновик состава — решение владельца (docs/BACKLOG.md, «Ждёт владельца»); out_of_scope — только по нему.
import type { CatalogTopic } from './catalog';

const w = (id: string): CatalogTopic => ({ id, status: 'written' });

export const CONCERN_CATALOG: readonly CatalogTopic[] = [
  w('bpd'),
  w('narcissism'),
  w('depression'),
  {
    id: 'anxiety',
    title:
      'Тревожные расстройства (генерализованная, социальная тревога, паника)',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 13'],
    note: 'жалоба → режим — Кембридж гл. 3, табл. 3.2',
  },
  {
    id: 'ocd',
    title: 'ОКР',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 13'],
    note: 'бокс 13.3: стул Здорового Взрослого и Предупреждающий режим',
  },
  {
    id: 'adjustment_disorder',
    title: 'Расстройство адаптации',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 13'],
  },
  {
    id: 'ptsd',
    title: 'ПТСР и комплексная травма',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 14'],
    note: 'заметка complex_trauma «Для терапевта» — только про расспрос',
  },
  {
    id: 'eating_disorders',
    title: 'Расстройства пищевого поведения',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 15'],
  },
  {
    id: 'cluster_c',
    title: 'Кластер C: избегающее, зависимое, обсессивно-компульсивное РЛ',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 2', 'гл. 11'],
    note: 'профили режимов есть, программы лечения нет — её даёт Arntz, Jacob 2013 (полка «Арнтц», карты нет)',
  },
  {
    id: 'other_personality_disorders',
    title:
      'Другие расстройства личности: истерическое, параноидное, антисоциальное',
    status: 'planned',
    source: 'Кембридж',
    chapters: ['гл. 2'],
    note: 'только профили режимов',
  },
  {
    id: 'relationship_patterns',
    title: 'Повторяющиеся паттерны в отношениях, выбор партнёра',
    status: 'planned',
    source: 'Якоб',
    chapters: [],
    note: 'карты книги нет; «химия схем» при выборе партнёра — Young, Klosko «Reinventing Your Life» (на полке нет)',
  },
  {
    id: 'couples',
    title: 'Работа с парами',
    status: 'needs_source',
    book: 'Simeone-DiFrancesco, Roediger, Stevens «Schema Therapy with Couples», 2015',
  },
  {
    id: 'adolescents',
    title: 'Подростки и дети',
    status: 'needs_source',
    book: 'Loose, Graaf, Zarbock, Holt «Schema Therapy for Children and Adolescents», 2020',
  },
  {
    id: 'addictions',
    title: 'Зависимости (двойной фокус)',
    status: 'needs_source',
    book: 'Ball — Dual Focus Schema Therapy; глава о зависимостях в «The Wiley-Blackwell Handbook of Schema Therapy», 2012',
  },
  {
    id: 'chronic_somatic',
    title: 'Хронические и соматические жалобы, хроническая боль',
    status: 'needs_source',
    book: 'обзор или руководство о схемах при хронической боли и соматоформных расстройствах (подобрать)',
  },
  {
    id: 'forensic',
    title: 'Судебная модель: правонарушители',
    status: 'out_of_scope',
    why: 'владелец вычеркнул Кембридж гл. 16 (2026-11-19, docs/guide-sources/Кембридж.md): справочник — для онлайн-практики',
  },
];
