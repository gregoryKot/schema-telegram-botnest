// @vitest-environment jsdom
// HeatmapCard — тепловая карта грузит history(112) лениво, только когда
// карточка показалась во вьюпорте (замер 2026-08-22: history(112) — самый
// тяжёлый запрос вкладки «Я» и не нужен для первого экрана).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { HeatmapCard } from './HeatmapCard';

vi.mock('../../api', () => ({
  api: { history: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

let capturedCallback: IntersectionObserverCallback | null = null;
const observe = vi.fn();

class FakeObserver {
  constructor(cb: IntersectionObserverCallback) {
    capturedCallback = cb;
  }
  observe = observe;
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds: number[] = [];
}

function intersect(isIntersecting: boolean) {
  capturedCallback!(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

beforeEach(() => {
  capturedCallback = null;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('HeatmapCard — ленивая загрузка', () => {
  it('не запрашивает history(112), пока карточка не показалась во вьюпорте', () => {
    mockApi.history.mockReturnValue(new Promise(() => {}));
    render(<HeatmapCard totalDays={10} />);
    expect(mockApi.history).not.toHaveBeenCalled();
    expect(screen.getByTestId('heatmap-skeleton')).toBeTruthy();
  });

  it('показавшись во вьюпорте — запрашивает 112 дней и рисует карту', async () => {
    mockApi.history.mockResolvedValue([
      { date: '2026-08-20', modes: 1, schemas: 0 },
    ]);
    render(<HeatmapCard totalDays={10} />);
    intersect(true);
    await waitFor(() => expect(mockApi.history).toHaveBeenCalledWith(112));
    await waitFor(() =>
      expect(screen.queryByTestId('heatmap-skeleton')).toBeNull(),
    );
    expect(screen.getByText('Активность')).toBeTruthy();
  });

  it('нет активных дат — карточка не рендерится вовсе (не выдуманная пустая карта)', async () => {
    mockApi.history.mockResolvedValue([]);
    const { container } = render(<HeatmapCard totalDays={0} />);
    intersect(true);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('запрос падает — фолбэк на пустой набор, а не вечный скелетон', async () => {
    mockApi.history.mockRejectedValue(new Error('network'));
    const { container } = render(<HeatmapCard totalDays={0} />);
    intersect(true);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
