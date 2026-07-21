// @vitest-environment jsdom
// Кризисная детекция в проверке убеждения (CLAUDE.md, правило №7). Проверяем
// поле "belief" на первом шаге мастера — остальные свободнотекстовые стейты
// (forInput/againstInput/reframe) используют тот же гейт в BeliefCheckEx.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BeliefCheckEx } from './BeliefCheckEx';

vi.mock('../../api', () => ({
  api: {
    getBeliefChecks: vi.fn(),
    createBeliefCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <BeliefCheckEx onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getBeliefChecks.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('BeliefCheckEx — кризисная детекция (belief)', () => {
  it('кризисная фраза в убеждении показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: я всегда всё порчу, меня никто не любит…');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText('Например: я всегда всё порчу, меня никто не любит…');
    fireEvent.change(textarea, { target: { value: 'Я иногда ошибаюсь на работе' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
