// События вкладки «План работы» → раскладка «По фазам» (путь клиента, #1522) и отметки пунктов в итогах
// сессии. Реестр рядом с фичей (правило №10), в allow-list попадает через CABINET_EVENTS. Только сайт.
// Название фазы, текст пункта, клиент и сам пункт в событие не попадают (правило №7).
// Санитайзер — src/api/analytics-meta.sanitize-path.ts, блок в /stats — src/bot/path-metrics.*.
//   therapy_path_created       — путь собран; meta { template }: id шаблона или 'empty' (пустой путь).
//   therapy_path_phase_started — фаза начата (в том числе следующая при «Завершить и перейти»); meta { phase }.
//   therapy_path_phase_finished — фаза завершена; meta { phase }. phase — ключ фазы шаблона или 'custom'.
//   therapy_path_dates_shifted — «Сдвинуть сроки» у фазы, что идёт дольше плана; без meta.
//   therapy_path_draft_built   — из листа черновика собран путь; meta { picked }: сколько пунктов выбрано (0..50).
//   therapy_plan_session_marked — в итогах сессии сохранены отметки пунктов плана; meta { items }: 1..50.
// Парный список фронта — shared/src/therapy/path/templates/*.ts (сверка — path-events.sync.spec.ts).
// prettier-ignore
export const PATH_TEMPLATE_IDS = ['general', 'brief50', 'bpd24', 'empty'] as const;
// prettier-ignore
export const PATH_PHASE_KEYS = [
  'assessment', 'bonding', 'change', 'autonomy', 'ending',
  'intro', 'past', 'present', 'boosters',
  'start', 'intensive', 'patterns', 'biweekly', 'monthly',
  'custom',
] as const;
export const PATH_ITEMS_MAX = 50;

import { PLAN_EVENTS } from './plan-events.constants';

export const PATH_EVENTS = [
  'therapy_path_created',
  'therapy_path_phase_started',
  'therapy_path_phase_finished',
  'therapy_path_dates_shifted',
  'therapy_path_draft_built',
  'therapy_plan_session_marked',
] as const;

/** Все события вкладки «План работы»: подключается в CABINET_EVENTS. */
export const PLAN_PATH_EVENTS = [...PLAN_EVENTS, ...PATH_EVENTS] as const;
