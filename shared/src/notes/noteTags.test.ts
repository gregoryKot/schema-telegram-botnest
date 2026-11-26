// Темы дня: один список на выбор и показ (аудит 2026-11, today-history-day — история
// рисовала сохранённые id «work», «creativity» вместо подписей).
import { describe, it, expect } from 'vitest';
import { NOTE_TAGS, noteTagLabels } from './noteTags';

describe('noteTagLabels', () => {
  it('каждый id из списка выбора находит свою подпись, порядок — как сохранили', () => {
    const saved = ['creativity', 'work'];
    expect(noteTagLabels(saved)).toEqual([
      { id: 'creativity', label: 'Творчество' },
      { id: 'work', label: 'Работа' },
    ]);
    expect(
      noteTagLabels(NOTE_TAGS.map((t) => t.id)).map((t) => t.label),
    ).toEqual(NOTE_TAGS.map((t) => t.label));
  });

  it('незнакомый id не показывается сырым', () => {
    expect(noteTagLabels(['work', 'gone_tag'])).toEqual([
      { id: 'work', label: 'Работа' },
    ]);
    expect(noteTagLabels([])).toEqual([]);
  });

  it('id и подписи не повторяются', () => {
    expect(new Set(NOTE_TAGS.map((t) => t.id)).size).toBe(NOTE_TAGS.length);
    expect(new Set(NOTE_TAGS.map((t) => t.label)).size).toBe(NOTE_TAGS.length);
  });
});
