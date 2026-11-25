// Каталог-цель вкладки «Запросы и расстройства» (kb/catalog.ts): что должно быть по литературе.
// planned пишет агент пачкой «запрос: <id>» (knowledge-base.md, раздел 7); out_of_scope — только решение владельца.
import type { CatalogTopic } from './catalog';

const w = (id: string): CatalogTopic => ({ id, status: 'written' });

export const CONCERN_CATALOG: readonly CatalogTopic[] = [
  w('bpd'),
  w('narcissism'),
  w('depression'),
  w('cluster_c'),
  w('other_personality_disorders'),
  w('adolescents'),
  w('couples'),
  w('ptsd'),
  w('eating_disorders'),
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
    id: 'relationship_patterns',
    title: 'Повторяющиеся паттерны в отношениях, выбор партнёра',
    status: 'planned',
    source: 'Пары',
    chapters: ['гл. 4'],
    note: 'пачка 15 карты; «химия схем» при выборе партнёра — ещё Young, Klosko «Reinventing Your Life» (на полке нет)',
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
