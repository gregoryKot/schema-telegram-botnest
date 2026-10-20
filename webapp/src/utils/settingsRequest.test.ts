// @vitest-environment jsdom
// Общий стартовый запрос настроек: потребители одного прохода эффектов делят
// один GET, а более поздний вызов идёт заново.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', () => ({ api: { getSettings: vi.fn() } }));
import { api } from '../api';
import { loadSettingsShared } from './settingsRequest';

const getSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  getSettings.mockReset();
  getSettings.mockImplementation(() => Promise.resolve({ addressForm: 'vy' }));
});

describe('loadSettingsShared', () => {
  it('вызовы в одном проходе делят один запрос', async () => {
    const [a, b] = [loadSettingsShared(), loadSettingsShared()];
    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    await expect(a).resolves.toEqual({ addressForm: 'vy' });
  });

  it('более поздний вызов идёт на сервер заново — настройки не залипают', async () => {
    await loadSettingsShared();
    await loadSettingsShared();
    expect(getSettings).toHaveBeenCalledTimes(2);
  });

  it('зависший запрос не раздаётся следующим вызовам', async () => {
    getSettings.mockImplementationOnce(() => new Promise(() => undefined));
    void loadSettingsShared();
    await Promise.resolve();
    await expect(loadSettingsShared()).resolves.toEqual({ addressForm: 'vy' });
  });
});
