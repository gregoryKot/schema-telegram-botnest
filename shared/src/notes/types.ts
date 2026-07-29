/**
 * Форма карточек-заметок (схема/режим), как их отдаёт и принимает бэкенд
 * (UserSchemaNote/UserModeNote в schema.prisma, notes.dto.ts). Единый
 * источник для типов `webapp/src/api.ts` и `schema-miniapp/src/api.ts` —
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
  updatedAt: string;
}

/** Тело запроса сохранения заметки схемы — частичный апсерт, все поля кроме id опциональны. */
export type SaveSchemaNoteBody = { schemaId: string } & Partial<
  Omit<UserSchemaNote, 'schemaId' | 'updatedAt'>
>;

/** Тело запроса сохранения заметки режима — частичный апсерт, все поля кроме id опциональны. */
export type SaveModeNoteBody = { modeId: string } & Partial<
  Omit<UserModeNote, 'modeId' | 'updatedAt'>
>;
