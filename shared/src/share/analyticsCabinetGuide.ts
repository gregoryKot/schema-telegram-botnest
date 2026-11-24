// «Справочник» терапевта (#995, /cabinet/guide): открыл раздел; оттуда — лист режима, схемы, потребности, техники, «Для терапевта», запроса, фазы.
export const CABINET_GUIDE_OPEN_EVENT = 'cabinet_guide_open';
export const CABINET_GUIDE_SHEET_EVENTS = {
  mode: 'cabinet_guide_mode_open',
  schema: 'cabinet_guide_schema_open',
  technique: 'cabinet_guide_technique_open',
  note: 'cabinet_guide_note_open',
  need: 'cabinet_guide_need_open',
  concern: 'cabinet_guide_concern_open',
  phase: 'cabinet_guide_phase_open',
} as const;
// «Схемы» в «Справочнике» переключили на вид «Таблицей»: все схемы и три копинга рядом.
export const CABINET_GUIDE_TABLE_EVENT = 'cabinet_guide_table_open';
// Карточка-ответ над выдачей поиска «Справочника»: показана / переход по её ссылке. Без меты: ни листа, ни запроса.
export const CABINET_GUIDE_ANSWER_EVENTS = {
  show: 'cabinet_guide_answer_show',
  link: 'cabinet_guide_answer_link',
} as const;
// Отметка «Про клиента» (#1484): пишет сервер при создании, meta { kind } — вид статьи или 'coping'. Фронт не шлёт.
export const GUIDE_MARK_ADDED_EVENT = 'guide_mark_added';
export type GuideMarkKind =
  | 'schema'
  | 'mode'
  | 'technique'
  | 'note'
  | 'concern'
  | 'phase'
  | 'need'
  | 'coping';
