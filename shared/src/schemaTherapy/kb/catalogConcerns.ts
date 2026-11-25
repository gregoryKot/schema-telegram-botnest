// Каталог-цель вкладки «Запросы и расстройства» (kb/catalog.ts): что должно быть по литературе.
// planned пишет агент пачкой «запрос: <id>» (knowledge-base.md, раздел 7); out_of_scope — только решение владельца.
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
    note: 'заметка complex_trauma «Для терапевта» — только про расспрос; порядок воспоминаний и блок из 12 сессий — ещё [Хис, гл. 7]',
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
    source: 'Пары',
    chapters: ['гл. 4'],
    note: 'пачка 15 карты; «химия схем» при выборе партнёра — ещё Young, Klosko «Reinventing Your Life» (на полке нет)',
  },
  {
    id: 'couples',
    title: 'Работа с парами',
    status: 'planned',
    source: 'Пары',
    chapters: ['гл. 1', 'гл. 2', 'гл. 4', 'гл. 5', 'гл. 10', 'гл. 11'],
    note: 'пачки 1–4 карты: основа, сессия, курс, кризис и спутники',
  },
  {
    id: 'adolescents',
    title: 'Дети и подростки',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 1', 'гл. 2', 'гл. 3', 'гл. 5', 'гл. 6', 'гл. 7', 'гл. 8'],
  },
  {
    id: 'infant_regulation',
    title: 'Родитель и младенец: плач, сон, кормление',
    status: 'planned',
    source: 'Луз',
    chapters: ['гл. 4'],
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
