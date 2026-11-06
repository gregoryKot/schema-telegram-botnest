// @vitest-environment jsdom
// Read-after-write: настройка, сделанная на другом устройстве (лежит на сервере),
// должна дойти до экрана на сайте, а запись на сайте — не стереть
// ключи, которых на этом устройстве нет. Идём через настоящие: шлюз, общий
// синхронизатор и localStorage; подменены только сеть. Зонд читает флаг
// `why_seen_v1` и переключает меню «Инструменты» (`quick_actions_hidden_tools`).
import { useState } from 'react';
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

const getSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;
const updateSettings = api.updateSettings as unknown as ReturnType<typeof vi.fn>;

// Потребитель ключей настройки: флаг «объяснение показано» + кнопка, которая
// меняет скрытые пункты «Инструментов» и сообщает синхронизатору об изменении.
const TOOLS_KEY = 'quick_actions_hidden_tools';
function TodayProbe() {
  const [, bump] = useState(0);
  return (
    <div>
      <span data-testid="streak">{localStorage.getItem('why_seen_v1') === '1' ? 'hidden' : 'shown'}</span>
      <button
        onClick={() => {
          localStorage.setItem(TOOLS_KEY, '["tracker"]');
          notifyPrefsChanged();
          bump((n) => n + 1);
        }}
      >
        toggle
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('UiPrefsGate + настройки экранов', () => {
  it('сервер прислал скрытую серию → флаг скрыт; до ответа экран не монтируется', async () => {
    let answer!: (v: unknown) => void;
    getSettings.mockReturnValue(new Promise((r) => (answer = r)));
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    expect(screen.queryByTestId('streak')).toBeNull();

    await act(async () => answer({ uiPrefs: { why_seen_v1: '1' } }));
    expect(screen.getByTestId('streak').textContent).toBe('hidden');
    expect(localStorage.getItem('why_seen_v1')).toBe('1');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('сервер очистил настройку → локальный флаг снят (server wins)', async () => {
    localStorage.setItem('ui_prefs_migrated', '1');
    localStorage.setItem('why_seen_v1', '1');
    getSettings.mockResolvedValue({ uiPrefs: {} });
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    await waitFor(() => expect(screen.getByTestId('streak').textContent).toBe('shown'));
  });

  it('изменение на сайте уходит на сервер вместе с ключами с других устройств, а не вместо них', async () => {
    getSettings.mockResolvedValue({
      uiPrefs: { why_seen_v1: '1', screen_order_profile: '["portrait","journey"]' },
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
        why_seen_v1: '1',
        screen_order_profile: '["portrait","journey"]',
        quick_actions_hidden_tools: '["tracker"]',
      },
    });
  });

  // Ререндер шлюза (родитель обновился) не перезапускает стартовую
  // синхронизацию: раньше `load` был новой стрелкой на каждом рендере, эффект
  // повторял GET и reset() закрывал пуш до ответа — правка в это окно терялась
  // (так «мигал» тест выше в CI).
  it('ререндер шлюза не перезапрашивает настройки и не закрывает пуш', async () => {
    getSettings.mockResolvedValue({ uiPrefs: { why_seen_v1: '1' } });
    const tree = (n: number) => (
      <UiPrefsGate key="gate">
        <TodayProbe />
        <span>{n}</span>
      </UiPrefsGate>
    );
    const { rerender } = render(tree(0));
    await waitFor(() => expect(screen.getByTestId('streak').textContent).toBe('hidden'));
    rerender(tree(1));
    rerender(tree(2));
    expect(getSettings).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText('toggle'));
      await act(() => vi.advanceTimersByTimeAsync(2000));
    } finally {
      vi.useRealTimers();
    }
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it('первый ответ сервера пуст, а на устройстве уже есть настройка сайта → она мигрирует на сервер', async () => {
    localStorage.setItem('quick_actions_order_tools', '["tracker"]');
    getSettings.mockResolvedValue({ uiPrefs: {} });
    render(
      <UiPrefsGate>
        <TodayProbe />
      </UiPrefsGate>,
    );
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({ uiPrefs: { quick_actions_order_tools: '["tracker"]' } }),
    );
    expect(screen.getByTestId('streak').textContent).toBe('shown');
  });

  it('GET настроек отказал → экран открывается с локальными значениями, на сервер ничего не уходит', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('why_seen_v1', '1');
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
