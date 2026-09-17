// @vitest-environment jsdom
// App.tsx — начальный эффект загрузки: today-key/streak-celebration/childhood
// wheel из РЕАЛЬНЫХ данных (правило «никаких хардкод-заглушек»), сброс
// «сохранено» при новой оценке. Роль/реконсиляция терапевта/ты-вы/start_param
// — в App.dataload.role.test.tsx (потолок 300 строк на файл). Дочерние
// секции/оверлеи — заглушки (App.test-helpers.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { renderApp, mockUseUserFlags } from './test-support/App.test-helpers';
import { defaultFlags } from './test-support/App.test-fixtures';
import { api } from './api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockUseUserFlags.mockReturnValue(defaultFlags());
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('App — TODAY_KEY выставляется только когда ВСЕ потребности реально оценены', () => {
  it('needs и ratings совпадают полностью → celebrated_<today> в localStorage', async () => {
    mockApi.needs.mockResolvedValueOnce([
      {
        id: 'attachment',
        emoji: '',
        title: 'Привязанность',
        chartLabel: 'Прив.',
      },
      { id: 'autonomy', emoji: '', title: 'Автономия', chartLabel: 'Авт.' },
    ]);
    mockApi.ratings
      .mockResolvedValueOnce({ attachment: 7, autonomy: 5 })
      .mockResolvedValueOnce({});
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith('celebrated_'),
    );
    expect(key).toBeTruthy();
    expect(localStorage.getItem(key!)).toBe('1');
  });

  it('оценена только часть потребностей → TODAY_KEY не пишется', async () => {
    mockApi.needs.mockResolvedValueOnce([
      {
        id: 'attachment',
        emoji: '',
        title: 'Привязанность',
        chartLabel: 'Прив.',
      },
      { id: 'autonomy', emoji: '', title: 'Автономия', chartLabel: 'Авт.' },
    ]);
    mockApi.ratings
      .mockResolvedValueOnce({ attachment: 7 })
      .mockResolvedValueOnce({});
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith('celebrated_'),
    );
    expect(key).toBeUndefined();
  });
});

describe('App — сохранение со стриком: селебрейшн с РЕАЛЬНЫМ числом, не выдуманным', () => {
  it('первое сохранение сегодня со стриком > 0 → celebrationStreak = реальное значение стрика', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-overlays-save-with-streak'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.celebrationStreak).toBe(
        '3',
      ),
    );
  });

  it('стрик = 0 → без селебрейшна, сразу заметка дня (todayNote)', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-overlays-save-no-streak'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.todayNote).toBe('true'),
    );
    expect(screen.getByTestId('app-overlays').dataset.celebrationStreak).toBe(
      '',
    );
  });

  it('totalDays >= 5 и колесо детства ещё не пройдено → childhoodWheelPending включается', async () => {
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-overlays-save-with-big-streak'));
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.childhoodPending).toBe(
        'true',
      ),
    );
  });

  it('повторное сохранение в тот же день (TODAY_KEY уже стоит) не триггерит селебрейшн повторно', async () => {
    mockApi.needs.mockResolvedValueOnce([
      {
        id: 'attachment',
        emoji: '',
        title: 'Привязанность',
        chartLabel: 'Прив.',
      },
    ]);
    mockApi.ratings
      .mockResolvedValueOnce({ attachment: 5 })
      .mockResolvedValueOnce({});
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('app-overlays-save-with-streak'));
    // TODAY_KEY уже стоял до клика (все потребности оценены при загрузке) —
    // handleSaved не устанавливает его повторно и не открывает селебрейшн.
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.celebrationStreak).toBe(
        '',
      ),
    );
  });
});

describe('App — оценка потребности (handleChange) обновляет рейтинг и сбрасывает «сохранено»', () => {
  it('onChange(attachment, 7) после сохранения сбрасывает saved обратно на false', async () => {
    mockApi.needs.mockResolvedValueOnce([
      {
        id: 'attachment',
        emoji: '',
        title: 'Привязанность',
        chartLabel: 'Прив.',
      },
    ]);
    mockApi.ratings
      .mockResolvedValueOnce({ attachment: 5 })
      .mockResolvedValueOnce({});
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.savedAttachment).toBe(
        'true',
      ),
    );
    fireEvent.click(screen.getByTestId('app-overlays-change'));
    await waitFor(() => {
      expect(screen.getByTestId('app-overlays').dataset.ratingAttachment).toBe(
        '7',
      );
      expect(screen.getByTestId('app-overlays').dataset.savedAttachment).toBe(
        'false',
      );
    });
  });
});
