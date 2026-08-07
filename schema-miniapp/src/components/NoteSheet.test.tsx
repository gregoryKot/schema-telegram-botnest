// @vitest-environment jsdom
// Правило №7 CLAUDE.md: заметка к дню — свободный текст, обязана проходить
// через кризисную детекцию. Тест проверяет только появление карточки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { NoteSheet } from './NoteSheet';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn(),
    saveNote: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getNote.mockResolvedValue({ text: '', tags: [] });
  mockApi.saveNote.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function renderSheet() {
  render(<NoteSheet date="2026-07-20" onClose={() => {}} />);
  await act(async () => {}); // flush getNote()
  return screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...');
}

describe('NoteSheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу больше жить' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });

  it('карточка появляется от одного набора текста — ДО клика «Сохранить» и ДО любого сетевого запроса', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу больше жить' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
    expect(mockApi.saveNote).not.toHaveBeenCalled();
  });
});

describe('NoteSheet — сохранение: read-after-write и видимая ошибка', () => {
  it('успешное сохранение закрывает лист (onClose) — заметка ушла на сервер', async () => {
    const onClose = vi.fn();
    render(<NoteSheet date="2026-07-20" onClose={onClose} />);
    await act(async () => {});
    const textarea = screen.getByPlaceholderText(
      'Что происходило сегодня? Любая мысль...',
    );
    fireEvent.change(textarea, {
      target: { value: 'сегодня был хороший день' },
    });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(mockApi.saveNote).toHaveBeenCalledWith(
        '2026-07-20',
        'сегодня был хороший день',
        [],
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('открытие того же дня снова подтягивает сохранённый текст с сервера (read-after-write)', async () => {
    mockApi.getNote.mockResolvedValueOnce({
      text: 'уже сохранённая заметка',
      tags: ['rest'],
    });
    render(<NoteSheet date="2026-07-20" onClose={() => {}} />);
    await act(async () => {});
    expect(screen.getByDisplayValue('уже сохранённая заметка')).toBeTruthy();
  });

  it('падение saveNote показывает видимую ошибку и НЕ закрывает лист молча', async () => {
    const onClose = vi.fn();
    mockApi.saveNote.mockRejectedValueOnce(new Error('network down'));
    render(<NoteSheet date="2026-07-20" onClose={onClose} />);
    await act(async () => {});
    const textarea = screen.getByPlaceholderText(
      'Что происходило сегодня? Любая мысль...',
    );
    fireEvent.change(textarea, {
      target: { value: 'заметка, которая не долетит' },
    });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText(/Не удалось сохранить/)).toBeTruthy(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('текст ошибки звучит в обеих формах обращения (ты/вы)', async () => {
    mockApi.saveNote.mockRejectedValueOnce(new Error('down'));
    const tyTextarea = renderWithForm(
      <NoteSheet date="2026-07-20" onClose={() => {}} />,
      'ty',
    ).getByPlaceholderText('Что происходило сегодня? Любая мысль...');
    await act(async () => {});
    fireEvent.change(tyTextarea, { target: { value: 'текст на ты' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText(/Попробуй ещё раз/)).toBeTruthy(),
    );
    cleanup();

    mockApi.saveNote.mockRejectedValueOnce(new Error('down'));
    const vyTextarea = renderWithForm(
      <NoteSheet date="2026-07-20" onClose={() => {}} />,
      'vy',
    ).getByPlaceholderText('Что происходило сегодня? Любая мысль...');
    await act(async () => {});
    fireEvent.change(vyTextarea, { target: { value: 'текст на вы' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() =>
      expect(screen.getByText(/Попробуйте ещё раз/)).toBeTruthy(),
    );
  });
});
