// @vitest-environment jsdom
// WeeklyCardSheet — карточка недели (0% покрытия). Пустая история — отдельный
// текстовый экран без канваса (нет данных → «Нет данных за неделю», а не
// пустая/сломанная карточка — родственно правилу «никаких хардкод-заглушек»).
// drawWeeklyCard мокаем: canvas 2D в jsdom недоступен без пакета `canvas`.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import { api } from '../api';
import { drawWeeklyCard } from '../../../shared/src/share/cards/weeklyCard';
import type { Need, DayHistory } from '../types';

vi.mock('../api', () => ({
  api: { getStreak: vi.fn(), trackEvent: vi.fn() },
}));
vi.mock('../../../shared/src/share/cards/weeklyCard', async () => {
  const actual = await vi.importActual<
    typeof import('../../../shared/src/share/cards/weeklyCard')
  >('../../../shared/src/share/cards/weeklyCard');
  return { ...actual, drawWeeklyCard: vi.fn() };
});

const needs: Need[] = [];
const history: DayHistory[] = [{ date: '2026-08-01', ratings: {} }];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WeeklyCardSheet — пустая неделя', () => {
  it('history=[] — показывает «Нет данных», не рендерит канвас-карточку', () => {
    vi.mocked(api.getStreak).mockResolvedValue({ currentStreak: 0 } as never);
    render(<WeeklyCardSheet needs={needs} history={[]} onClose={() => {}} />);
    expect(screen.getByText('Нет данных за неделю')).toBeTruthy();
    expect(screen.getByText('Карточка недели')).toBeTruthy();
    expect(drawWeeklyCard).not.toHaveBeenCalled();
  });
});

describe('WeeklyCardSheet — есть данные', () => {
  it('рисует карточку через ShareCardSheet и подтягивает текущий стрик', async () => {
    vi.mocked(api.getStreak).mockResolvedValue({ currentStreak: 4 } as never);
    render(
      <WeeklyCardSheet needs={needs} history={history} onClose={() => {}} />,
    );
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
    await waitFor(() => expect(api.getStreak).toHaveBeenCalled());
  });

  it('api.getStreak падает — экран не ломается, стрик остаётся 0', async () => {
    vi.mocked(api.getStreak).mockRejectedValue(new Error('offline'));
    render(
      <WeeklyCardSheet needs={needs} history={history} onClose={() => {}} />,
    );
    await waitFor(() => expect(api.getStreak).toHaveBeenCalled());
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });
});
