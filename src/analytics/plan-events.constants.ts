// События вкладки «План работы» карточки клиента в кабинете терапевта — реестр рядом с фичей
// (правило №10), в allow-list попадает через CABINET_EVENTS. Только сайт. Текст пункта, клиент и
// статья справочника в событие не попадают (правило №7).
// Санитайзер — src/api/analytics-meta.sanitize-cabinet.ts, блок в /stats — src/bot/plan-metrics.*.
//   therapy_plan_item_added  — пункт добавлен в план; meta { rubric, fromGuide }: рубрика из
//                              PLAN_RUBRICS и пришёл ли пункт из статьи справочника.
//   therapy_plan_item_status — терапевт переключил статус пункта; meta { status } из PLAN_STATUSES.
export const PLAN_EVENTS = [
  'therapy_plan_item_added',
  'therapy_plan_item_status',
] as const;
