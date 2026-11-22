// @vitest-environment jsdom
// backend#29: заметка сессии на 6000 знаков раньше «сохранялась» на 5000 —
// сервер молча резал хвост, а поле предела не показывало. Предел теперь один
// (SESSION_NOTE_MAX = @MaxLength в DTO), и поле показывает его до отправки.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClientSessionsTab } from './ClientSessionsTab';
import type { ClientDetail } from './clientSheetTypes';
import { SESSION_NOTE_MAX } from '../../../../shared/src/limits/textLimits';
import { makeClientDetail } from './clientDetail.test-helpers';

afterEach(() => {
  cleanup();
});

function renderTab(newNoteText: string) {
  const detail = makeClientDetail({ newNoteDate: '2026-10-11', newNoteText });
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

describe('ClientSessionsTab — композер и таймлайн', () => {
  function make(over: Partial<ClientDetail>) {
    const detail = makeClientDetail({ newNoteDate: '2026-10-11', newNoteText: 'текст', ...over });
    render(<ClientSessionsTab detail={detail} />);
    return detail;
  }

  it('Ctrl+Enter сохраняет заметку', () => {
    const d = make({});
    fireEvent.keyDown(screen.getByPlaceholderText(/Наблюдения/), { key: 'Enter', ctrlKey: true });
    expect(d.addNote).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Enter с пустым текстом ничего не сохраняет', () => {
    const d = make({ newNoteText: '  ' });
    fireEvent.keyDown(screen.getByPlaceholderText(/Наблюдения/), { key: 'Enter', metaKey: true });
    expect(d.addNote).not.toHaveBeenCalled();
  });

  it('номера сессий — по дате, а не по позиции в списке', () => {
    make({
      notesPage: {
        notes: [
          { id: 2, therapistId: 1, clientId: 2, date: '2026-10-10', text: 'новая', createdAt: '2026-10-10T10:00:00Z' },
          { id: 1, therapistId: 1, clientId: 2, date: '2026-09-01', text: 'старая', createdAt: '2026-09-01T10:00:00Z' },
        ],
        total: 2,
      },
    });
    expect(screen.getByText('Архив · 2 заметки')).toBeTruthy();
    expect(screen.getByText('Сессия 2')).toBeTruthy();
    expect(screen.getByText('Сессия 1')).toBeTruthy();
  });
});
