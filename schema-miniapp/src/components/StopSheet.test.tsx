// @vitest-environment jsdom
// Правило №8 CLAUDE.md: продуктовая фича = событие аналитики. Проверяем, что
// stop_start уходит РОВНО один раз при маунте (аналог breath_start у
// BreathingCard), без провайдера addressForm — дефолт «ты» из
// AddressFormContext (см. utils/addressForm.tsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StopSheet } from './StopSheet';

vi.mock('../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('StopSheet', () => {
  it('шлёт stop_start ровно один раз при открытии', () => {
    render(<StopSheet onClose={() => {}} />);
    expect(mockApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('stop_start');
  });

  it('первый шаг — «С — Стоп» (дефолтная форма «ты» без провайдера)', () => {
    render(<StopSheet onClose={() => {}} />);
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });
});
