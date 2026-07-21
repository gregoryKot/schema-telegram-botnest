// @vitest-environment jsdom
// Правило №7 CLAUDE.md: все текстовые поля проверки убеждения (убеждение,
// за/против, переформулировка) обязаны проходить через кризисную детекцию.
// Тест бьёт по первому (belief) и последнему (reframe) шагу — оба используют
// один и тот же CrisisGate, остальные шаги устроены идентично.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { BeliefCheck } from './BeliefCheck';

vi.mock('../api', () => ({
  api: {
    getBeliefChecks: vi.fn(),
    createBeliefCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getBeliefChecks.mockResolvedValue([]);
  mockApi.createBeliefCheck.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function renderSheet() {
  render(<BeliefCheck onClose={() => {}} />);
  await act(async () => {}); // flush getBeliefChecks()
  return screen.getByPlaceholderText(
    'Например: я всегда всё порчу, меня никто не любит...',
  );
}

describe('BeliefCheck — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в убеждении', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном убеждении', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'я всегда опаздываю' } });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });

  it('показывает карточку на шаге переформулировки при кризисной фразе', async () => {
    const belief = await renderSheet();
    fireEvent.change(belief, { target: { value: 'я всегда опаздываю' } });
    fireEvent.click(screen.getByText('Дальше →')); // -> for
    fireEvent.click(screen.getByText('Дальше →')); // -> against
    fireEvent.click(screen.getByText('Дальше →')); // -> reframe
    const reframe = screen.getByPlaceholderText(
      'Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу...',
    );
    fireEvent.change(reframe, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });
});
