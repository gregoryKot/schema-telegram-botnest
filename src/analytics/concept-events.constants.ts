// События графической концептуализации в кабинете терапевта — реестр рядом с фичей (вынесен из
// analytics.constants.ts по правилу №10, как CASE_EVENTS/GAME_EVENTS). Все без meta, кроме булева
// on у concept_shared: тексты связей и опыт схем — клиническая запись, id клиента и свободный
// текст в событие не попадают (правило №7).
// Блок в /stats — src/bot/concept-graph-metrics.*. Где не сказано иначе — только сайт.
//   concept_graph_open / concept_mode_linked / concept_schema_linked — оба фронта: открыл схему
//     случая; заполнил связи режима (схемы, потребности, истоки); записал убеждение / опыт схемы.
//   concept_canvas_open      — карта собрана из концептуализации: «Открыть на холсте» или создание
//                              карты типа «Концептуализация» в выборе типа «Графических карт» (#963).
//   concept_graph_fullscreen — развернул схему случая на весь экран («⤢ На весь экран»).
//   concept_save_retry       — «Повторить» после ошибки сохранения (SaveStatusLine, #879); три
//                              места на обоих фронтах: вкладка сайта, холст, кнопка мини-аппа.
//   concept_brief_open       — открыл экран «Главное» (кнопка в шапке вкладки).
//   concept_sync_to_map      — «Добавить на карту» в строке связи над холстом: поля → холст (#963).
//   concept_sync_from_map    — холст дописал в концептуализацию режим, схему или связь (#963).
//   concept_guide_mode_open / concept_guide_schema_open / concept_guide_technique_open — подсказки
//     терапевту (#995): открыл лист режима или схемы («Подробнее о режиме» / «Подробнее о схеме» на
//     плашке «Обычно в методе») / лист техники (с плашки или из листа режима или схемы).
//   concept_guide_assign     — «Дать заданием» у пункта «Между сессиями» (плашка или лист режима или схемы).
//   concept_guide_mark_done  — «Делали сегодня» в листе техники из схемы случая: отметка поставлена
//                              (снятие тем же тапом события не шлёт). Какая техника и чей режим — нет.
//   concept_guide_journal_open  — «журнал →» за «делали …» (плашка, лист режима или схемы, лист техники):
//                                 переход в журнал техник, блок «На сессиях» вкладки «Задания».
//   concept_guide_journal_entry — тап по строке журнала техник: открыт лист техники. Какая техника — нет.
//   concept_shared           — терапевт включил или выключил «Показать клиенту»; meta { on: boolean },
//                              других полей нет (src/api/analytics-meta.sanitize.ts).
//   client_concept_opened    — клиент открыл схему случая из «Мой терапевт» (лист загрузился).
export const CONCEPT_EVENTS = [
  'concept_graph_open',
  'concept_mode_linked',
  'concept_schema_linked',
  'concept_canvas_open',
  'concept_graph_fullscreen',
  'concept_save_retry',
  'concept_brief_open',
  'concept_sync_to_map',
  'concept_sync_from_map',
  'concept_guide_mode_open',
  'concept_guide_schema_open',
  'concept_guide_technique_open',
  'concept_guide_assign',
  'concept_guide_mark_done',
  'concept_guide_journal_open',
  'concept_guide_journal_entry',
  'concept_shared',
  'client_concept_opened',
] as const;
