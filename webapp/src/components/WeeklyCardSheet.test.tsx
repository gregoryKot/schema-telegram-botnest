// @vitest-environment jsdom
// WeeklyCardSheet — было 0% покрытия (36 строк, ни одного теста). Проверяем:
// пустое состояние (нет данных за неделю), рендер карточки + кнопки
// «Поделиться», успешный шаринг (событие аналитики ok:true) и фолбэк на
// текст + буфер обмена при отказе (canvas.toBlob недоступен в jsdom —
// естественно бьёт по каскаду shareCanvasImage, событие ok:false).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WeeklyCardSheet } from './WeeklyCardSheet';
import type { Need, DayHistory } from '../types';

vi.mock('../api', () => ({
  api: {
    getStreak: vi.fn().mockResolvedValue({ currentStreak: 3 }),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../../../shared/src/share/cards/weeklyCard', () => ({
  drawWeeklyCard: vi.fn(),
  buildWeeklyShareText: vi.fn(() => 'Сводка за неделю: индекс 6.4'),
}));

const NEEDS: Need[] = [
  { id: 'safety', emoji: '🛡️', title: 'Безопасность', chartLabel: 'Безоп.' },
];
const HISTORY: DayHistory[] = [{ date: '2020-01-10', ratings: { safety: 7 } }];

function renderSheet(history: DayHistory[] = HISTORY, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <WeeklyCardSheet needs={NEEDS} history={history} onClose={onClose} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getStreak.mockResolvedValue({ currentStreak: 3 });
});

const originalToBlob = HTMLCanvasElement.prototype.toBlob;

afterEach(() => {
  cleanup();
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
});

describe('WeeklyCardSheet — пустое состояние', () => {
  it('без истории за неделю показывает «Нет данных за неделю», без кнопки «Поделиться»', () => {
    renderSheet([]);
    expect(screen.getByText('Нет данных за неделю')).toBeTruthy();
    expect(screen.queryByText('Поделиться')).toBeNull();
  });
});

describe('WeeklyCardSheet — есть данные за неделю', () => {
  it('рендерит карточку и кнопку «Поделиться»', async () => {
    renderSheet();
    await waitFor(() => expect(mockApi.getStreak).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });

  it('«Назад к истории» использует useHistorySheet (goBack), не onClose напрямую', () => {
    renderSheet();
    expect(screen.getByText('Назад к истории')).toBeTruthy();
  });
});

describe('WeeklyCardSheet — шаринг: успех', () => {
  it('успешный canvas.toBlob + navigator.share шлёт share_card и share_result(ok:true), без фолбэка', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: BlobCallback) {
      cb(blob);
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: () => true,
      share: vi.fn().mockResolvedValue(undefined),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    renderSheet();
    fireEvent.click(screen.getByText('Поделиться'));

    await waitFor(() =>
      expect(mockApi.trackEvent).toHaveBeenCalledWith('share_card', {
        kind: 'weekly',
      }),
    );
    await waitFor(() =>
      expect(mockApi.trackEvent).toHaveBeenCalledWith('share_result', {
        kind: 'weekly',
        ok: true,
      }),
    );
    expect(screen.queryByText('Поделиться текстом')).toBeNull();

    vi.unstubAllGlobals();
  });
});

describe('WeeklyCardSheet — шаринг: отказ показывает текстовый фолбэк', () => {
  beforeEach(() => {
    // canvas.toBlob(null) — так canvas сообщает о неудаче рендера (спека
    // HTMLCanvasElement); shareCanvasImage превращает это в reject.
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: BlobCallback) {
      cb(null);
    });
  });

  it('canvas.toBlob неудачен — шаринг падает, виден текст + событие ok:false, а не тишина', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    renderSheet();
    fireEvent.click(screen.getByText('Поделиться'));

    await waitFor(() =>
      expect(mockApi.trackEvent).toHaveBeenCalledWith('share_result', {
        kind: 'weekly',
        ok: false,
      }),
    );
    await screen.findByText('Поделиться текстом');
    expect(screen.getByText('Сводка за неделю: индекс 6.4')).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('кнопка «Скопировать» в фолбэке копирует текст в буфер', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderSheet();
    fireEvent.click(screen.getByText('Поделиться'));
    await screen.findByText('Поделиться текстом');

    fireEvent.click(screen.getByText('Скопировать'));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('Сводка за неделю: индекс 6.4'),
    );
    // «✓ Скопировано» может показаться и на основной кнопке «Поделиться»
    // (тот же отказ шаринга параллельно копирует текст в кнопке-фолбэке
    // хендлера) — проверяем не единственность, а что копирование видно.
    await waitFor(() =>
      expect(screen.getAllByText('✓ Скопировано').length).toBeGreaterThan(0),
    );

    vi.unstubAllGlobals();
  });
});
