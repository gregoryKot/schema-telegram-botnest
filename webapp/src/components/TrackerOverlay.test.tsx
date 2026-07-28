// @vitest-environment jsdom
// Компонентные тесты TrackerOverlay (webapp): открытие, выбор потребности,
// сохранение оценки (debounce автосейва), пустое состояние, ошибка API.
// Образец сетапа: schema-miniapp/src/components/TrackerOverlay.test.tsx
// (мок '../api', vi.useFakeTimers для debounce) + webapp/src/utils/addressForm.test.tsx
// (jsdom-окружение, мок api-модуля).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrackerOverlay } from './TrackerOverlay';
import type { Need } from '../types';

// useHistorySheet (внутри TrackerOverlay) требует react-router-контекст
// (useNavigate/useLocation) — оборачиваем в MemoryRouter (CLAUDE.md: не
// эмулировать историю напрямую).
vi.mock('../api', () => ({
  api: { ratings: vi.fn(), saveRating: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
];

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    needs: NEEDS,
    ratings: {},
    saved: {},
    onChange: vi.fn(),
    onSaved: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderOverlay(overrides: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <TrackerOverlay {...baseProps(overrides)} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockApi.saveRating.mockResolvedValue({ ok: true, allDone: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TrackerOverlay — открытие', () => {
  it('показывает название и вопрос дня текущей потребности', () => {
    renderOverlay();
    // Заголовок потребности (attachment: 'Привязанность') рендерится кнопкой.
    expect(
      screen.getByRole('button', { name: 'Привязанность' }),
    ).toBeTruthy();
  });

  it('открывает нужную потребность по initialNeedId, а не первую в списке', () => {
    renderOverlay({ initialNeedId: 'autonomy' });
    expect(screen.getByRole('button', { name: 'Автономия' })).toBeTruthy();
  });
});

describe('TrackerOverlay — выбор потребности', () => {
  it('клик по точке шага переключает отображаемую потребность', () => {
    renderOverlay();
    expect(screen.getByRole('button', { name: 'Привязанность' })).toBeTruthy();

    const dots = screen.getAllByLabelText('Автон.');
    fireEvent.click(dots[0]);

    expect(screen.getByRole('button', { name: 'Автономия' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Привязанность' })).toBeNull();
  });
});

describe('TrackerOverlay — сохранение оценки', () => {
  it('клик по цифре пикера сразу пробрасывает значение наверх (onChange)', () => {
    const onChange = vi.fn();
    renderOverlay({ onChange });
    fireEvent.click(screen.getByText('7'));
    expect(onChange).toHaveBeenCalledWith('attachment', 7);
  });

  it('api.saveRating вызывается только после паузы 500мс (debounce)', () => {
    renderOverlay();
    fireEvent.click(screen.getByText('7'));
    expect(mockApi.saveRating).not.toHaveBeenCalled();
  });

  it('после debounce сохраняет через api и вызывает onSaved', async () => {
    mockApi.saveRating.mockResolvedValue({ ok: true, allDone: true, streak: { count: 3 } });
    const onSaved = vi.fn();
    renderOverlay({ onSaved });
    fireEvent.click(screen.getByText('7'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockApi.saveRating).toHaveBeenCalledWith('attachment', 7);
    expect(onSaved).toHaveBeenCalledWith('attachment', { count: 3 });
  });
});

describe('TrackerOverlay — пустое состояние', () => {
  it('без оценок кнопка действия ведёт «к незаполненным», а не «готово»', () => {
    renderOverlay({ initialNeedId: 'autonomy' });
    // Автономия — последняя потребность в списке, ничего не оценено:
    // nextNeed нет, allRated=false -> кнопка "К незаполненным".
    expect(
      screen.getByRole('button', { name: /К незаполненным/ }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Готово/ })).toBeNull();
  });

  it('когда все потребности оценены — кнопка действия «Готово»', () => {
    renderOverlay({
      initialNeedId: 'autonomy',
      ratings: { attachment: 5, autonomy: 6 },
    });
    expect(screen.getByRole('button', { name: /Готово/ })).toBeTruthy();
  });
});

describe('TrackerOverlay — ошибка API', () => {
  it('ошибка api.saveRating не роняет компонент и не вызывает onSaved', async () => {
    mockApi.saveRating.mockRejectedValue(new Error('network'));
    const onSaved = vi.fn();
    renderOverlay({ onSaved });
    fireEvent.click(screen.getByText('7'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onSaved).not.toHaveBeenCalled();
    // Компонент по-прежнему смонтирован и реагирует на дальнейшие клики.
    expect(screen.getByRole('button', { name: 'Привязанность' })).toBeTruthy();
  });
});

describe('TrackerOverlay — бэкафилл прошлой даты', () => {
  it('при наличии date подгружает оценки через api.ratings и показывает загрузку до ответа', async () => {
    mockApi.ratings.mockReturnValue(new Promise(() => {})); // никогда не резолвится
    renderOverlay({ date: '2026-07-10' });
    expect(screen.getByText('Загрузка...')).toBeTruthy();
    expect(mockApi.ratings).toHaveBeenCalledWith('2026-07-10');
  });

  it('после загрузки оценок за прошлую дату убирает спиннер и показывает потребность', async () => {
    mockApi.ratings.mockResolvedValue({ attachment: 4 });
    renderOverlay({ date: '2026-07-10' });
    await act(async () => {});
    expect(screen.queryByText('Загрузка...')).toBeNull();
    expect(screen.getByRole('button', { name: 'Привязанность' })).toBeTruthy();
  });
});

// Регрессия (аудит 3.3, правило «Никаких хардкод-заглушек»): при отсутствии
// РЕАЛЬНОЙ вчерашней оценки потребности дельта «вчера ±N» не рисуется вовсе.
// До фикса фолбэк на константу YESTERDAY выдавал выдуманную дельту на чистом
// аккаунте (тот же инцидент, что описан в правиле; miniapp-двойник был чист).
describe('дельта «вчера» — только из реальных данных', () => {
  // Дельта рисуется только в DesktopLayout — форсим десктоп через ширину
  // окна (useIsDesktop читает window.innerWidth при маунте), иначе оба
  // кейса тривиально-зелёные (в мобильном лейауте блока «вчера» нет вовсе).
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
  });
  it('без вчерашних оценок блока «вчера» нет, даже когда сегодня оценка стоит', () => {
    renderOverlay({
      ratings: { attachment: 5 },
      yesterdayRatings: {},
      initialNeedId: 'attachment',
    });
    expect(screen.queryByText(/вчера/i)).toBeNull();
  });

  it('с реальной вчерашней оценкой дельта показывается', () => {
    renderOverlay({
      ratings: { attachment: 5 },
      yesterdayRatings: { attachment: 3 },
      initialNeedId: 'attachment',
    });
    expect(screen.queryByText(/вчера/i)).toBeTruthy();
  });
});
