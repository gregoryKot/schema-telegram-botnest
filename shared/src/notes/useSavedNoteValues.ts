// Уже написанное в карточке схемы/режима — для опросника, который открывается
// не из экрана паттерна (там значения приходят готовыми, `MyCardItem.values`).
// Опросник шлёт на сервер все поля разом, поэтому стартовать с пустой формы
// при заполненной карточке нельзя: так «Познакомиться →» в SchemaDetailSheet
// затирал написанное (docs/INCIDENTS.md, 2026-10-31). Пока заметка грузится,
// `loading` — форма не монтируется, на её месте скелетон.
import { useEffect, useState } from 'react';
import type { MyCardsKind, PatternNotesApi } from '../pattern/useMyCards';
import {
  SCHEMA_NOTE_FIELD_ORDER,
  MODE_NOTE_FIELD_ORDER,
  type NoteFieldKey,
  type NoteFieldSource,
} from '../share/cards/noteCard';

/** Заполненные поля заметки по ключам вопросов (пустые не попадают). */
export function noteValues(
  note: NoteFieldSource,
  order: NoteFieldKey[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of order) {
    const text = note[key]?.trim();
    if (text) values[key] = text;
  }
  return values;
}

function loadValues(
  kind: MyCardsKind,
  id: string,
  api: PatternNotesApi,
): Promise<Record<string, string> | undefined> {
  if (kind === 'schema')
    return api.getSchemaNotes().then((notes) => {
      const note = notes.find((n) => n.schemaId === id);
      return note ? noteValues(note, SCHEMA_NOTE_FIELD_ORDER) : undefined;
    });
  return api.getModeNotes().then((notes) => {
    const note = notes.find((n) => n.modeId === id);
    return note ? noteValues(note, MODE_NOTE_FIELD_ORDER) : undefined;
  });
}

export interface SavedNoteState {
  loading: boolean;
  values: Record<string, string> | undefined;
  /** Загрузка упала: форма открывается пустой, и человеку об этом говорят —
   *  иначе пустые поля читаются как «написанное пропало». */
  failed: boolean;
}

/**
 * `preset` — значения, уже известные вызывающему (экран паттерна): тогда
 * запроса нет. `id = null` — схема/режим ещё не выбраны. Ошибка загрузки
 * отдаёт пустую форму с `failed`: сервер пустые поля поверх написанного не
 * пишет. `api` — стабильная ссылка (объект модуля площадки).
 */
export function useSavedNoteValues(
  kind: MyCardsKind,
  id: string | null,
  api: PatternNotesApi,
  preset?: Record<string, string>,
): SavedNoteState {
  const skip = !id || preset !== undefined;
  const [loaded, setLoaded] = useState<
    (Omit<SavedNoteState, 'loading'> & { key: string }) | null
  >(null);
  const key = `${kind}:${id ?? ''}`;

  useEffect(() => {
    if (skip || !id) return;
    let alive = true;
    loadValues(kind, id, api).then(
      (values) => {
        if (alive) setLoaded({ key, values, failed: false });
      },
      () => {
        if (alive) setLoaded({ key, values: undefined, failed: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [kind, id, key, skip, api]);

  if (skip) return { loading: false, values: preset, failed: false };
  if (loaded?.key !== key)
    return { loading: true, values: undefined, failed: false };
  return { loading: false, values: loaded.values, failed: loaded.failed };
}
