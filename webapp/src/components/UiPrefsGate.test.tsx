// @vitest-environment jsdom
// Read-after-write: настройка, сделанная в мини-аппе (лежит на сервере),
// должна дойти до экрана «Сегодня» на сайте, а запись на сайте — не стереть
// ключи, которых на этом устройстве нет. Идём через настоящие: шлюз, общий
// синхронизатор и хук настройки «Сегодня»; подменены только сеть и localStorage-фон.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../api', () => ({
  api: {
    getSettings: vi.fn(),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
import { UiPrefsGate } from './UiPrefsGate';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';
import { useTodayCustomization } from '../../../shared/src/today/useTodayCustomization';

const getSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;
const updateSettings = api.updateSettings as unknown as ReturnType<typeof vi.fn>;

// Потребитель ключей кастомизации (общий хук с мини-аппом): серия показана или скрыта + кнопка.
function TodayProbe() {
  const t = useTodayCustomization({ api, onChanged: notifyPrefsChanged });
  return (
    <div>
      <span data-testid="streak">{t.streakHidden ? 'hidden' : 'shown'}</span>
      <button onClick={t.toggleSecondary}>toggle</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('UiPrefsGate + «Сегодня»', () => {
  it('сервер прислал скрытую серию → «Сегодня» её не показывает; до ответа экран не монтируется', async () => {
    let answer!: (v: unknown) => void;
    getSettings.mockReturnValue(new Promise((r) => (answer = r)));
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    expect(screen.queryByTestId('streak')).toBeNull();

    await act(async () => answer({ uiPrefs: { today_streak_hidden: '1' } }));
    expect(screen.getByTestId('streak').textContent).toBe('hidden');
    expect(localStorage.getItem('today_streak_hidden')).toBe('1');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('сервер очистил настройку → локальная скрытая серия снова показана (server wins)', async () => {
    localStorage.setItem('ui_prefs_migrated', '1');
    localStorage.setItem('today_streak_hidden', '1');
    getSettings.mockResolvedValue({ uiPrefs: {} });
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    await waitFor(() => expect(screen.getByTestId('streak').textContent).toBe('shown'));
  });

  it('изменение на сайте уходит на сервер вместе с ключами из мини-аппа, а не вместо них', async () => {
    getSettings.mockResolvedValue({
      uiPrefs: { today_streak_hidden: '1', screen_order_today: '["phrase","focus"]' },
    });
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    await waitFor(() => expect(screen.getByTestId('streak').textContent).toBe('hidden'));

    // Пуш идёт через debounce 1.5 с: на настоящих таймерах под нагрузкой CI
    // (второй прогон под TZ=Australia/Sydney) окна waitFor не хватало — флак.
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText('toggle'));
      await act(() => vi.advanceTimersByTimeAsync(2000));
    } finally {
      vi.useRealTimers();
    }
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({
      uiPrefs: {
        today_streak_hidden: '1',
        screen_order_today: '["phrase","focus"]',
        today_secondary_hidden: '0', // по умолчанию скрыто, тумблер показал блок
      },
    });
  });

  it('первый ответ сервера пуст, а на устройстве уже есть настройка сайта → она мигрирует на сервер', async () => {
    localStorage.setItem('today_phrase_hidden', '1');
    getSettings.mockResolvedValue({ uiPrefs: {} });
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ uiPrefs: { today_phrase_hidden: '1' } }),
    );
    expect(screen.getByTestId('streak').textContent).toBe('shown');
  });

  it('GET настроек отказал → экран открывается с локальными значениями, на сервер ничего не уходит', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('today_streak_hidden', '1');
    getSettings.mockRejectedValue(new Error('offline'));
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    await waitFor(() => expect(screen.getByTestId('streak').textContent).toBe('hidden'));
    fireEvent.click(screen.getByText('toggle'));
    await new Promise((r) => setTimeout(r, 1700));
    expect(updateSettings).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
