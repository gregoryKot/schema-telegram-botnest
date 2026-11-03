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
import { SESSION_NOTE_MAX } from '../../../../shared/src/limits/textLimits';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  const notes = overrides.notes ?? [];
  return {
    notes,
    notesPage: { notes, total: notes.length },
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

  // QA 2026-10-26: заметку стирал один тап по «×» — теперь второй тап
  // подтверждает («Точно удалить?»), как у практик.
  it('первый тап по «×» спрашивает, второй зовёт removeNote с id заметки', () => {
    const removeNote = vi.fn().mockResolvedValue(undefined);
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
    expect(removeNote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Точно удалить?'));
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

// backend#29: заметка сессии на 6000 знаков раньше «сохранялась» на 5000 —
// сервер молча резал хвост. Предел теперь один (SESSION_NOTE_MAX = @MaxLength
// в DTO), и поле показывает его до отправки.
describe('NotesSheet — предел длины заметки', () => {
  const placeholder =
    'Заметка сессии: наблюдения, гипотезы, динамика, план следующей встречи...';

  it('textarea.maxLength = предел из shared; пока текста мало, счётчика нет', () => {
    render(<NotesSheet detail={makeDetail({ newNoteText: 'коротко' })} />);
    const area = screen.getByPlaceholderText(placeholder);
    expect(area.maxLength).toBe(SESSION_NOTE_MAX);
    expect(screen.queryByText(/Осталось знаков/)).toBeNull();
  });

  it('у границы показывает остаток, на пределе — сообщение о пределе', () => {
    const { rerender } = render(
      <NotesSheet
        detail={makeDetail({ newNoteText: 'а'.repeat(SESSION_NOTE_MAX - 100) })}
      />,
    );
    expect(screen.getByText(/Осталось знаков: 100/)).toBeTruthy();
    rerender(
      <NotesSheet
        detail={makeDetail({ newNoteText: 'а'.repeat(SESSION_NOTE_MAX) })}
      />,
    );
    expect(screen.getByText(/Достигнут предел/)).toBeTruthy();
  });
});

describe('NotesSheet — срез на сервере (признак «есть ещё»)', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      date: '2026-08-01',
      text: `t${i}`,
    })) as unknown as ClientDetail['notes'];

  it('заметок больше, чем показано: строка называет оба числа', () => {
    const notes = rows(100);
    render(
      <NotesSheet
        detail={makeDetail({
          notes,
          notesPage: { notes, total: 105 },
        })}
      />,
    );
    expect(screen.getByRole('note').textContent).toContain(
      'Показаны последние 100 из 105',
    );
  });

  it('показано всё: строки нет', () => {
    render(<NotesSheet detail={makeDetail({ notes: rows(2) })} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
