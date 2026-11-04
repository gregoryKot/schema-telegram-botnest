/**
 * Форма карточек-заметок (схема/режим), как их отдаёт и принимает бэкенд
 * (UserSchemaNote/UserModeNote в schema.prisma, notes.dto.ts). Единый
 * источник для типов `webapp/src/api.ts` (с удалённым мини-аппом) —
 * раньше это были два независимых, почти дословно продублированных
 * inline-интерфейса (правило №3 CLAUDE.md).
 */
export interface UserSchemaNote {
  schemaId: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  origins: string;
  reality: string;
  healthyView: string;
  behavior: string;
  updatedAt: string;
}

export interface UserModeNote {
  modeId: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  needs: string;
  behavior: string;
  origins: string;
  healthyView: string;
  /** Бланк проработки режима: функция режима и «даёт ли поведение то, что нужно». */
  modeFunction: string;
  needsMet: string;
  /** Имя, которым человек называет режим своими словами («Стена»). */
  alias: string;
  /** «Чего боишься, если этот режим перестанет так делать». */
  fear: string;
  updatedAt: string;
}

/** Тело запроса сохранения заметки схемы — частичный апсерт, все поля кроме id опциональны. */
export type SaveSchemaNoteBody = { schemaId: string } & Partial<
  Omit<UserSchemaNote, 'schemaId' | 'updatedAt'>
>;

/** Текстовые поля карточки режима. */
export type ModeNoteField = keyof Omit<UserModeNote, 'modeId' | 'updatedAt'>;

/** Тело запроса сохранения заметки режима — частичный апсерт, все поля кроме id опциональны.
 *  `fillIfEmpty` — поля, которые сервер пишет только в пустое место карточки. */
export type SaveModeNoteBody = { modeId: string } & Partial<
  Record<ModeNoteField, string>
> & { fillIfEmpty?: ModeNoteField[] };
