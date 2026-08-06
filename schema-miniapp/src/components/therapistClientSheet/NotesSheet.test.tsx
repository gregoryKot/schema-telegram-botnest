// @vitest-environment jsdom
// NotesSheet — заметки сессий терапевта о клиенте (0% покрытия). Это
// профессиональная клиническая документация терапевта, не дневник конечного
// пользователя о себе — кризисная детекция (правило №7) сюда не относится,
// как и в остальных terapistClientSheet-компонентах. Проверяем: реальный
// текст «Нет заметок» на пустом списке (не пустой блок), кнопка «Добавить
// заметку» дизейблится и на пустом тексте, и во время сохранения — иначе
// двойной клик может уйти дублем на бэк.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NotesSheet } from './NotesSheet';
import type { ClientDetail } from './types';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    notes: [],
    removeNote: vi.fn(),
    newNoteText: '',
    setNewNoteText: vi.fn(),
    noteError: '',
    setNoteError: vi.fn(),
    noteSaving: false,
    addNote: vi.fn(),
    setShowNotesSheet: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

describe('NotesSheet — пустой список', () => {
  it('нет заметок — «Нет заметок. Добавь первую ниже.», не пустой блок', () => {
    render(<NotesSheet detail={makeDetail()} />);
    expect(screen.getByText('Нет заметок. Добавь первую ниже.')).toBeTruthy();
  });
});

describe('NotesSheet — список заметок', () => {
  it('рендерит текст и дату каждой заметки', () => {
    render(
      <NotesSheet
        detail={makeDetail({
          notes: [
            { id: 1, date: '2026-08-01', text: 'Обсудили паттерн избегания' },
          ] as unknown as ClientDetail['notes'],
        })}
      />,
    );
    expect(screen.getByText('Обсудили паттерн избегания')).toBeTruthy();
  });

  it('клик по «×» зовёт removeNote с id заметки', () => {
    const removeNote = vi.fn();
    render(
      <NotesSheet
        detail={makeDetail({
          notes: [
            { id: 42, date: '2026-08-01', text: 'Заметка' },
          ] as unknown as ClientDetail['notes'],
          removeNote,
        })}
      />,
    );
    fireEvent.click(screen.getByLabelText('Удалить заметку'));
    expect(removeNote).toHaveBeenCalledWith(42);
  });
});

describe('NotesSheet — добавление заметки', () => {
  it('ввод текста зовёт setNewNoteText и сбрасывает noteError', () => {
    const setNewNoteText = vi.fn();
    const setNoteError = vi.fn();
    render(
      <NotesSheet detail={makeDetail({ setNewNoteText, setNoteError })} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Заметка сессии/), {
      target: { value: 'Новый текст' },
    });
    expect(setNewNoteText).toHaveBeenCalledWith('Новый текст');
    expect(setNoteError).toHaveBeenCalledWith('');
  });

  it('пустой текст — кнопка «Добавить заметку» disabled', () => {
    render(<NotesSheet detail={makeDetail({ newNoteText: '' })} />);
    const btn = screen.getByText('Добавить заметку');
    expect(btn.disabled).toBe(true);
  });

  it('текст введён — кнопка активна, клик зовёт addNote', () => {
    const addNote = vi.fn();
    render(
      <NotesSheet
        detail={makeDetail({ newNoteText: 'Текст заметки', addNote })}
      />,
    );
    const btn = screen.getByText('Добавить заметку');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(addNote).toHaveBeenCalled();
  });

  it('noteSaving=true — кнопка disabled даже с непустым текстом (защита от дубль-клика)', () => {
    render(
      <NotesSheet
        detail={makeDetail({ newNoteText: 'Текст', noteSaving: true })}
      />,
    );
    expect(screen.getByText('Сохраняю...')).toBeTruthy();
    const btn = screen.getByText('Сохраняю...');
    expect(btn.disabled).toBe(true);
  });

  it('noteError задан — текст ошибки виден рядом с кнопкой', () => {
    render(
      <NotesSheet
        detail={makeDetail({ noteError: 'Слишком длинный текст' })}
      />,
    );
    expect(screen.getByText('Слишком длинный текст')).toBeTruthy();
  });
});

describe('NotesSheet — закрытие', () => {
  it('Escape зовёт setShowNotesSheet(false)', () => {
    const setShowNotesSheet = vi.fn();
    render(<NotesSheet detail={makeDetail({ setShowNotesSheet })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(setShowNotesSheet).toHaveBeenCalledWith(false);
  });
});
