// @vitest-environment jsdom
// Кризисная детекция в письме уязвимому ребёнку (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LetterEx } from './LetterEx';

vi.mock('../../api', () => ({
  api: {
    getLetters: vi.fn(),
    createLetter: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <LetterEx onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getLetters.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('LetterEx — кризисная детекция', () => {
  it('кризисная фраза в тексте письма показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Дорогой я, всё будет хорошо.' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
