import { describe, expect, it } from 'vitest';
import type { TherapistNote } from '../apiTypes';
import {
  EMPTY_NOTES_PAGE,
  addNoteToPage,
  compareNotesAsc,
  hiddenCount,
  notesHint,
  removeNoteFromPage,
} from './notesPage';

const note = (id: number, date: string, createdAt = `${date}T10:00:00.000Z`) =>
  ({
    id,
    date,
    createdAt,
    text: `n${id}`,
    therapistId: '1',
    clientId: '2',
  }) as TherapistNote;

describe('compareNotesAsc', () => {
  it('сначала по дате, потом по времени создания, потом по id', () => {
    const a = note(5, '2026-01-02', '2026-03-01T00:00:00.000Z');
    const b = note(1, '2026-01-03', '2026-01-01T00:00:00.000Z');
    expect(compareNotesAsc(a, b)).toBeLessThan(0);
    const c = note(2, '2026-01-02', '2026-03-02T00:00:00.000Z');
    expect(compareNotesAsc(a, c)).toBeLessThan(0);
    const d = note(6, '2026-01-02', '2026-03-01T00:00:00.000Z');
    expect(compareNotesAsc(a, d)).toBeLessThan(0);
    expect(compareNotesAsc(a, a)).toBe(0);
  });
});

describe('addNoteToPage', () => {
  it('новая заметка встаёт по дате (старее — ниже), total растёт', () => {
    const page = {
      notes: [note(2, '2026-02-01'), note(1, '2026-01-01')],
      total: 5,
    };
    const res = addNoteToPage(page, note(3, '2026-01-15'));
    expect(res.notes.map((n) => n.id)).toEqual([2, 3, 1]);
    expect(res.total).toBe(6);
  });

  it('на пустой странице: одна заметка, total 1', () => {
    const res = addNoteToPage(EMPTY_NOTES_PAGE, note(1, '2026-01-01'));
    expect(res).toEqual({ notes: [note(1, '2026-01-01')], total: 1 });
    expect(EMPTY_NOTES_PAGE.notes).toHaveLength(0);
  });
});

describe('removeNoteFromPage', () => {
  it('удаляет показанную заметку и уменьшает total', () => {
    const page = {
      notes: [note(2, '2026-02-01'), note(1, '2026-01-01')],
      total: 5,
    };
    const res = removeNoteFromPage(page, 1);
    expect(res.notes.map((n) => n.id)).toEqual([2]);
    expect(res.total).toBe(4);
  });

  it('несуществующий id не трогает total и возвращает ту же страницу', () => {
    const page = { notes: [note(1, '2026-01-01')], total: 3 };
    expect(removeNoteFromPage(page, 99)).toBe(page);
  });

  it('total не уходит в минус', () => {
    const page = { notes: [note(1, '2026-01-01')], total: 0 };
    expect(removeNoteFromPage(page, 1).total).toBe(0);
  });
});

describe('hiddenCount / notesHint', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => note(i + 1, '2026-01-01'));

  it('срез: 100 из 105 → скрыто 5, строка называет оба числа', () => {
    const page = { notes: many(100), total: 105 };
    expect(hiddenCount(page)).toBe(5);
    expect(notesHint(page)).toBe(
      'Показаны последние 100 из 105. Более ранние заметки сохранены, но здесь не выводятся.',
    );
  });

  it('показано всё → строки нет', () => {
    expect(notesHint({ notes: many(100), total: 100 })).toBeNull();
    expect(notesHint({ notes: many(3), total: 3 })).toBeNull();
  });

  it('пустое состояние: без NaN и без строки', () => {
    expect(hiddenCount(EMPTY_NOTES_PAGE)).toBe(0);
    expect(notesHint(EMPTY_NOTES_PAGE)).toBeNull();
  });

  it('total меньше длины списка (рассинхрон) не даёт отрицательного скрытого', () => {
    expect(hiddenCount({ notes: many(3), total: 1 })).toBe(0);
  });
});
