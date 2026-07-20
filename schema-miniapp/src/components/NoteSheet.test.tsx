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
} from '@testing-library/react';
import { NoteSheet } from './NoteSheet';

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
});
