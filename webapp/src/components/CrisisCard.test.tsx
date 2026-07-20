// @vitest-environment jsdom
// Тесты обёртки CrisisCard (CLAUDE.md, правило №7: свободный текст = кризисный
// путь + правило №8: аналитика). Тело карточки — в shared/src/components, эта
// обёртка прокидывает tr (ты/вы) и track (api.trackEvent) — именно это и тестируем.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CrisisCard } from './CrisisCard';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

vi.mock('../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as { trackEvent: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CrisisCard — рендер', () => {
  it('показывает телефон доверия и role="status"', () => {
    render(<CrisisCard surface="note" />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });
});

describe('CrisisCard — аналитика показа (правило №8)', () => {
  it('с surface: при маунте трекает crisis_card_shown с {surface}', () => {
    render(<CrisisCard surface="note" />);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('crisis_card_shown', { surface: 'note' });
  });

  it('без surface: маунт НЕ трекает crisis_card_shown (постоянная карточка помощи не засоряет метрику)', () => {
    render(<CrisisCard />);
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith('crisis_card_shown', expect.anything());
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });
});
