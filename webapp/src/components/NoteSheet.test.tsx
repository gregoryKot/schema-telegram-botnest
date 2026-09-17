// @vitest-environment jsdom
// Кризисная детекция в заметке дневника (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoteSheet } from './NoteSheet';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn(),
    saveNote: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <NoteSheet date="2026-07-20" onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getNote.mockResolvedValue({ text: '', tags: [] });
});

afterEach(() => {
  cleanup();
});

describe('NoteSheet — кризисная детекция', () => {
  it('кризисная фраза в тексте заметки показывает CrisisCard', async () => {
    await act(async () => { renderSheet(); });
    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', async () => {
    await act(async () => { renderSheet(); });
    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...');
    fireEvent.change(textarea, { target: { value: 'Сегодня был спокойный день' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// Загрузка существующей заметки (read-after-write контур: сохранённое должно
// быть найдено при повторном открытии, а не показывать пустое поле).
describe('NoteSheet — загрузка существующей заметки', () => {
  it('предзаполняет текст из api.getNote(date), а не показывает пустое поле', async () => {
    mockApi.getNote.mockResolvedValue({ text: 'Вчера был трудный разговор', tags: [] });
    await act(async () => { renderSheet(); });

    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe('Вчера был трудный разговор'));
  });

  it('ошибка api.getNote не роняет экран — поле остаётся пустым, а не выдуманным текстом', async () => {
    mockApi.getNote.mockRejectedValue(new Error('network down'));
    await act(async () => { renderSheet(); });

    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });
});

describe('NoteSheet — сохранение', () => {
  it('кнопка «Сохранить» задизейблена на пустой заметке (нет текста и тегов)', async () => {
    await act(async () => { renderSheet(); });
    const saveBtn = screen.getByText('Сохранить') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('успешное сохранение вызывает api.saveNote с обрезанным текстом и датой', async () => {
    mockApi.saveNote.mockResolvedValue(undefined);
    await act(async () => { renderSheet(); });
    fireEvent.change(screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...'), {
      target: { value: '  заметка с пробелами  ' },
    });

    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(mockApi.saveNote).toHaveBeenCalledWith('2026-07-20', 'заметка с пробелами', []));
  });

  it('ошибка api.saveNote показывает сообщение, а не тишину, и не закрывает лист', async () => {
    mockApi.saveNote.mockRejectedValue(new Error('network down'));
    await act(async () => { renderSheet(); });
    fireEvent.change(screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...'), {
      target: { value: 'заметка' },
    });

    fireEvent.click(screen.getByText('Сохранить'));

    await screen.findByText('Не удалось сохранить. Попробуй ещё раз.');
    // Лист не закрылся — текст всё ещё в textarea.
    expect((screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement).value).toBe('заметка');
  });
});
