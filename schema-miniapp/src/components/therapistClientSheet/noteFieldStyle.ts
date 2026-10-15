import type { CSSProperties } from 'react';

/** Вид поля новой заметки сессии в NotesSheet (вынесен оттуда, правило №10). */
export const NOTE_FIELD_STYLE: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  resize: 'none',
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.5,
  fontFamily: 'inherit',
};
