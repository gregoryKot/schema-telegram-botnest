// Ответ на «вопрос недели» сохраняется заметкой к дню: к тексту ответа
// приклеивается заголовок «[Вопрос недели] <вопрос>». Предел заметки к дню —
// один (DAY_NOTE_MAX, `@MaxLength` в DTO), и он относится ко всей строке, а не
// только к ответу. Раньше поле ответа пускало 500 знаков, заголовок добавлял
// ещё ~100, и сервер молча отрезал хвост ответа (находка аудита 2026-10-11,
// backend#29). Теперь предел поля ответа — предел заметки минус заголовок.
import type { CSSProperties } from 'react';
import { DAY_NOTE_MAX } from '../../../shared/src/limits/textLimits';

export function buildWeeklyNote(question: string, answer: string): string {
  return `[Вопрос недели] ${question}\n\n${answer.trim()}`;
}

/** Сколько знаков остаётся на сам ответ после заголовка с вопросом. */
export function weeklyAnswerMax(question: string): number {
  return Math.max(0, DAY_NOTE_MAX - buildWeeklyNote(question, '').length);
}

/** Вид поля ответа в карточке «Вопрос недели» (вынесен из WeeklyQuestion.tsx, правило №10). */
export const ANSWER_FIELD_STYLE: CSSProperties = {
  width: '100%',
  background: 'rgba(var(--fg-rgb),0.06)',
  border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 'var(--r-10)',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.5,
  resize: 'none',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  marginBottom: 10,
};
