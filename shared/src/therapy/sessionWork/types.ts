// «Что делали» в итогах сессии (#1330): пункт заметки терапевта. Хранится
// зашифрованным JSON в TherapistNote.work; бэкенд держит копию границ и ключей
// (src/therapy/session-work.ts, сверка — session-work.sync.spec.ts).

export const SESSION_WORK_KINDS = ['technique', 'exercise', 'custom'] as const;
export type SessionWorkKind = (typeof SESSION_WORK_KINDS)[number];

export interface SessionWorkItem {
  id: string;
  kind: SessionWorkKind;
  /** TechniqueId или ExId; у «своего» нет. */
  refId?: string;
  /** Название «своего» пункта. */
  customName?: string;
  modeIds: string[];
  schemaIds: string[];
  needIds: string[];
  /** Ключ поля из каталога (fields.ts) → текст. */
  fields: Record<string, string>;
}

export const WORK_ITEMS_MAX = 12; // пунктов на запись
export const WORK_FIELDS_MAX = 6; // полей в пункте
export const WORK_VALUE_MAX = 600; // знаков в поле
export const WORK_CUSTOM_NAME_MAX = 80;
export const WORK_IDS_MAX = 12; // режимов, схем, потребностей в пункте
export const WORK_ID_MAX = 64; // знаков в id пункта, режима, схемы

/** Пункты одной записи сессии — ответ ручки пунктов по клиенту (`GET /api/therapy/notes/:clientId/work`). */
export interface SessionWorkEntry {
  noteId: number;
  /** День сессии, `YYYY-MM-DD`. */
  date: string;
  work: SessionWorkItem[];
}
