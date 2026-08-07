// @vitest-environment jsdom
// Регрессия: patch() показывало «Сохранено ✓» независимо от результата
// api.updateSettings — отказ сети выглядел как успех, а оптимистичный
// тумблер оставался в новом положении. Тест бьёт по видимому состоянию
// (aria-checked тумблера, текст ошибки), а не по факту вызова мока.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { usePatchSettings } from './usePatchSettings';
import { Toggle } from './ui';
import type { UserSettings } from '../../api';

vi.mock('../../api', () => ({
  api: { updateSettings: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as { updateSettings: ReturnType<typeof vi.fn> };

const BASE: UserSettings = {
  notifyEnabled: false,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false,
  pairCardDismissed: false,
  mySchemaIds: [],
  myModeIds: [],
  therapistShareCards: true,
  therapistShareProfile: true,
};

function Harness() {
  const [settings, setSettings] = useState<UserSettings | null>(BASE);
  const { patch, saveError } = usePatchSettings(
    settings,
    setSettings,
    () => {},
  );
  if (!settings) return null;
  return (
    <div>
      <Toggle
        on={settings.notifyEnabled}
        onClick={() => patch({ notifyEnabled: !settings.notifyEnabled })}
      />
      {saveError && <div>Не сохранилось</div>}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

describe('usePatchSettings — успех', () => {
  it('переключатель остаётся во новом положении, ошибки не видно', async () => {
    mockApi.updateSettings.mockResolvedValue(undefined);
    render(<Harness />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(toggle.getAttribute('aria-checked')).toBe('true'),
    );
    expect(screen.queryByText('Не сохранилось')).toBeNull();
  });
});

describe('usePatchSettings — отказ сети виден и откатывает переключатель', () => {
  it('тумблер включается оптимистично, затем откатывается назад, показывается ошибка', async () => {
    mockApi.updateSettings.mockRejectedValue(new Error('network down'));
    render(<Harness />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    // Оптимистичное состояние сразу видно...
    await waitFor(() =>
      expect(toggle.getAttribute('aria-checked')).toBe('true'),
    );
    // ...но после отказа откатывается, и причина видна, а не тишина.
    await screen.findByText('Не сохранилось');
    await waitFor(() =>
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
        'false',
      ),
    );
  });
});
