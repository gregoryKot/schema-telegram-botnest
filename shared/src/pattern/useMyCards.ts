// Загружает заполненные карточки-заметки (UserSchemaNote/UserModeNote) для
// вкладок «Схемы»/«Режимы» раздела «Паттерны». Пустые заметки (ни одного
// заполненного поля) не попадают в список вообще — «пусто = пусто», никаких
// выдуманных карточек на чистом аккаунте.
import { useEffect, useState } from 'react';
import { schemaMeta, modeMeta, type PatternMeta } from './patternMeta';
import type { UserSchemaNote, UserModeNote } from '../notes/types';
import {
  noteCardFields,
  SCHEMA_NOTE_FIELD_ORDER,
  MODE_NOTE_FIELD_ORDER,
  type NoteFieldKey,
  type NoteFieldSource,
  type NoteCardField,
} from '../share/cards/noteCard';
import { noteValues } from '../notes/useSavedNoteValues';

export type MyCardsKind = 'schema' | 'mode';

/** Срез api площадки, нужный списку карточек (транспорт у каждого фронтенда
 * свой — инъекция, как у useQuickPractice). Ссылки обязаны быть стабильными. */
export interface PatternNotesApi {
  getSchemaNotes: () => Promise<UserSchemaNote[]>;
  getModeNotes: () => Promise<UserModeNote[]>;
}

export interface MyCardItem {
  id: string;
  name: string;
  subtitle?: string;
  color: string;
  /** Текст первого заполненного поля — выжимка для строки списка. */
  excerpt: string;
  /** Все заполненные поля, уже готовые для drawNoteCard. */
  cardFields: NoteCardField[];
  /** Сырые значения заполненных полей по ключам вопросов — чтобы «Дополнить»
   *  открывало опросник с уже написанным, а не с пустыми полями (иначе
   *  сохранение затёрло бы карточку пустыми строками). */
  values: Record<string, string>;
}

function toItem(
  id: string,
  note: NoteFieldSource,
  order: NoteFieldKey[],
  meta: PatternMeta | null,
): MyCardItem | null {
  if (!meta) return null;
  const cardFields = noteCardFields(order, note);
  if (cardFields.length === 0) return null;
  const values = noteValues(note, order);
  return { id, ...meta, excerpt: cardFields[0].text, cardFields, values };
}

export function useMyCards(kind: MyCardsKind, api: PatternNotesApi) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MyCardItem[]>([]);
  // Счётчик перезагрузок: карточка правится в отдельном листе, и без этого
  // список остаётся со старой выжимкой, а только что заполненная карточка не
  // появляется вовсе, пока не уйдёшь с вкладки и не вернёшься (правило
  // read-after-write: «сохранил → нашёл», а не «сохранил»).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load =
      kind === 'schema'
        ? api
            .getSchemaNotes()
            .then((notes) =>
              notes.map((n) =>
                toItem(
                  n.schemaId,
                  n,
                  SCHEMA_NOTE_FIELD_ORDER,
                  schemaMeta(n.schemaId),
                ),
              ),
            )
        : api
            .getModeNotes()
            .then((notes) =>
              notes.map((n) =>
                toItem(n.modeId, n, MODE_NOTE_FIELD_ORDER, modeMeta(n.modeId)),
              ),
            );
    load
      .then((built) => {
        if (alive)
          setItems(built.filter((it): it is MyCardItem => it !== null));
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, reloadKey, api]);

  return { loading, items, reload: () => setReloadKey((k) => k + 1) };
}
