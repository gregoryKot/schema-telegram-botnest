// @vitest-environment jsdom
// Кризисная детекция в заметке дневника (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', async () => {
    await act(async () => { renderSheet(); });
    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...');
    fireEvent.change(textarea, { target: { value: 'Сегодня был спокойный день' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
