// События кабинета терапевта на сайте — реестр рядом с фичей (вынесен из analytics.constants.ts
// по правилу №10, как CONCEPT_EVENTS). Только сайт, без meta (кроме cabinet_session_work): что именно было на экране
// и кто из клиентов в списке, в событие не попадает (правило №7).
// Блоки в /stats — src/bot/screen-share-metrics.*, src/bot/guide-reference-metrics.*.
//   cabinet_screen_share_on — терапевт включил «Показ экрана» в левом сайдбаре: список клиентов
//                             спрятан в сайдбаре и в палитре «Перейти к…». Выключение не шлётся.
//   cabinet_guide_open      — открыл «Справочник» в меню терапевта (#995, /cabinet/guide).
//   cabinet_guide_mode_open / cabinet_guide_schema_open / cabinet_guide_technique_open /
//   cabinet_guide_note_open — из «Справочника» открыл лист режима, схемы, техники (из списка или
//     из листа режима и схемы) или раздела «Для терапевта». Те же листы из схемы случая клиента —
//     concept_guide_* (concept-events.constants.ts): справочник без клиента считается отдельно.
//     Какой режим, схема или техника — нет.
//   cabinet_session_work    — сохранил итоги сессии с пунктами «Что делали» (#1330); meta { items, kinds }:
//     число пунктов и их виды (technique / exercise / custom). Какая техника и текст полей — нет.
//     Строка в /stats — блок src/bot/concept-graph-metrics.* (рядом с журналом техник).
export const CABINET_EVENTS = [
  'cabinet_session_work',
  'cabinet_screen_share_on',
  'cabinet_guide_open',
  'cabinet_guide_mode_open',
  'cabinet_guide_schema_open',
  'cabinet_guide_technique_open',
  'cabinet_guide_note_open',
] as const;
