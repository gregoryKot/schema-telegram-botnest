// @vitest-environment jsdom
// backend#29: заметка сессии на 6000 знаков раньше «сохранялась» на 5000 —
// сервер молча резал хвост, а поле предела не показывало. Предел теперь один
// (SESSION_NOTE_MAX = @MaxLength в DTO), и поле показывает его до отправки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ClientSessionsTab } from './ClientSessionsTab';
import type { ClientDetail } from './clientSheetTypes';
import { SESSION_NOTE_MAX } from '../../../../shared/src/limits/textLimits';

afterEach(() => {
  cleanup();
});

function renderTab(newNoteText: string) {
  const detail = {
    newNoteDate: '2026-10-11',
    setNewNoteDate: vi.fn(),
    newNoteText,
    setNewNoteText: vi.fn(),
    addNote: vi.fn(),
    noteSaving: false,
    noteError: '',
    notes: [],
    removeNote: vi.fn(),
  } as unknown as ClientDetail;
  render(<ClientSessionsTab detail={detail} />);
  return screen.getByPlaceholderText(
    'Наблюдения, гипотезы, динамика, план следующей встречи…',
  ) as HTMLTextAreaElement;
}

describe('ClientSessionsTab — предел длины заметки', () => {
  it('textarea.maxLength = предел из shared; пока текста мало, счётчика нет', () => {
    const area = renderTab('коротко');
    expect(area.maxLength).toBe(SESSION_NOTE_MAX);
    expect(screen.queryByText(/Осталось знаков/)).toBeNull();
  });

  it('у границы показывает остаток', () => {
    renderTab('а'.repeat(SESSION_NOTE_MAX - 100));
    expect(screen.getByText(/Осталось знаков: 100/)).toBeTruthy();
  });

  it('на пределе — сообщение о пределе, а не молчаливый обрыв ввода', () => {
    renderTab('а'.repeat(SESSION_NOTE_MAX));
    expect(screen.getByText(/Достигнут предел/)).toBeTruthy();
  });
});
