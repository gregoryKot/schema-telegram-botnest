// «Справочник» терапевта (#995, /cabinet/guide): открыл раздел; оттуда — лист режима, схемы, потребности, техники, «Для терапевта».
export const CABINET_GUIDE_OPEN_EVENT = 'cabinet_guide_open';
export const CABINET_GUIDE_SHEET_EVENTS = {
  mode: 'cabinet_guide_mode_open',
  schema: 'cabinet_guide_schema_open',
  technique: 'cabinet_guide_technique_open',
  note: 'cabinet_guide_note_open',
  need: 'cabinet_guide_need_open',
} as const;
// «Схемы» в «Справочнике» переключили на вид «Таблицей»: все схемы и три копинга рядом.
export const CABINET_GUIDE_TABLE_EVENT = 'cabinet_guide_table_open';
// Карточка-ответ над выдачей поиска «Справочника»: показана / переход по её ссылке. Без меты: ни листа, ни запроса.
export const CABINET_GUIDE_ANSWER_EVENTS = {
  show: 'cabinet_guide_answer_show',
  link: 'cabinet_guide_answer_link',
} as const;
