// События кабинета терапевта на сайте — реестр рядом с фичей (вынесен из analytics.constants.ts
// по правилу №10, как CONCEPT_EVENTS). Только сайт, без meta (кроме cabinet_session_work): что именно было на экране
// и кто из клиентов в списке, в событие не попадает (правило №7). Блоки в /stats — src/bot/screen-share-metrics.*, src/bot/guide-reference-metrics.*.
//   cabinet_screen_share_on — терапевт включил «Показ экрана» в левом сайдбаре: список клиентов
//                             спрятан в сайдбаре и в палитре «Перейти к…». Выключение не шлётся.
//   cabinet_guide_open — открыл «Справочник» в меню терапевта (/cabinet/guide); cabinet_guide_{mode,schema,technique,note}_open —
//     открыл оттуда лист режима, схемы, техники или раздела «Для терапевта» (какой именно — нет). Те же листы из схемы
//     случая клиента — concept_guide_* (concept-events.constants.ts): справочник без клиента считается отдельно.
//   cabinet_guide_answer_show / _link — над выдачей поиска показана карточка-ответ / переход по её ссылке; без листа и запроса.
//   cabinet_session_work    — сохранил итоги сессии с пунктами «Что делали» (#1330); meta { items, kinds }:
//     число пунктов и их виды (technique / exercise / custom). Какая техника и текст полей — нет. Строка в /stats — блок src/bot/concept-graph-metrics.* (рядом с журналом техник).
//   cabinet_guide_table_open — в «Справочнике» переключил «Схемы» на вид «Таблицей» (все схемы и три копинга).
//   task_assign_source — терапевт назначил задание в листе «Новое задание»; meta { source } из
//     TASK_ASSIGN_SOURCES: плитка-упражнение, «Взять» из справочника или свой текст. Блок — src/bot/task-assign-metrics.*.
//   search_result_open — в общем поиске (⌘K, у клиента и у терапевта) открыли результат; meta { kind, typed, recent }:
//     вид из SEARCH_RESULT_KINDS (клиент, вкладка его карточки, раздел, лист справочника, задание из справочника, действие), был ли введён запрос и открыт ли результат из «Недавнего». Текста запроса, имени клиента, названий листа и задания нет. Блок — src/bot/search-metrics.*.
import { PLAN_EVENTS } from './plan-events.constants';
export const CABINET_EVENTS = [
  'cabinet_session_work',
  'cabinet_screen_share_on',
  'cabinet_guide_open',
  'cabinet_guide_mode_open',
  'cabinet_guide_schema_open',
  'cabinet_guide_technique_open',
  'cabinet_guide_note_open',
  'cabinet_guide_table_open',
  'cabinet_guide_answer_show',
  'cabinet_guide_answer_link',
  ...PLAN_EVENTS, // вкладка «План работы» карточки клиента
  'task_assign_source',
  'search_result_open',
] as const;

export const TASK_ASSIGN_SOURCES = ['tile', 'catalog', 'custom'] as const;
export type TaskAssignSource = (typeof TASK_ASSIGN_SOURCES)[number];

export const SEARCH_RESULT_KINDS = [
  'client',
  'client_tab',
  'section',
  'guide',
  'task',
  'action',
] as const;
export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];
