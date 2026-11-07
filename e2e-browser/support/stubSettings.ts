// Настройки пользователя для браузерных смоков: uiPrefs (настройка экранов —
// скрытые блоки, порядок, инструменты) живут в памяти теста, а не в
// фикстуре-константе. Так «скрыл → перезагрузил → скрыто» проходит через
// «сервер» с его настоящими правилами: POST чистится тем же sanitizeUiPrefs,
// что у SettingsController, и ЗАМЕНЯЕТ uiPrefs целиком; GET отдаёт сохранённое,
// а сайт применяет его по «server wins» (shared/src/prefs/uiPrefsSync.ts).
// Остальные поля настроек — фикстура SETTINGS (stubFixtures.ts).
import type { Route } from '@playwright/test';
import { sanitizeUiPrefs } from '../../src/api/ui-prefs.sanitize';
import { FIXTURES } from './stubFixtures';

export interface StubSettingsHandle {
  /** User.uiPrefs «на сервере»: спек задаёт его заранее (настройка с другого устройства). */
  uiPrefs: Record<string, string>;
  /** Тела POST /api/settings с uiPrefs — что сайт отправил, в порядке отправки. */
  uiPrefsPosts: Record<string, unknown>[];
  /** true — сервер не принимает запись (500, как Nest на сбое БД): правка не сохранена. */
  failWrites: boolean;
}

export function createSettingsState(): StubSettingsHandle {
  return { uiPrefs: {}, uiPrefsPosts: [], failWrites: false };
}

/** GET/POST `/api/settings`; true — путь обработан. */
export async function handleSettingsRoute(
  route: Route,
  state: StubSettingsHandle,
): Promise<boolean> {
  const req = route.request();
  if (new URL(req.url()).pathname !== '/api/settings') return false;
  const json = (status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  if (req.method() === 'GET') {
    // SettingsController.getSettings: `sanitizeUiPrefs(s?.uiPrefs) ?? {}`.
    const base = FIXTURES['GET /api/settings'] as Record<string, unknown>;
    await json(200, { ...base, uiPrefs: sanitizeUiPrefs(state.uiPrefs) ?? {} });
    return true;
  }
  if (req.method() !== 'POST') return false;
  const body = req.postDataJSON() as { uiPrefs?: Record<string, unknown> };
  if (body.uiPrefs !== undefined) state.uiPrefsPosts.push(body.uiPrefs);
  if (state.failWrites) {
    await json(500, { statusCode: 500, message: 'Internal server error' });
    return true;
  }
  if (body.uiPrefs !== undefined) {
    const prefs = sanitizeUiPrefs(body.uiPrefs);
    if (prefs) state.uiPrefs = prefs;
  }
  await json(201, FIXTURES['POST /api/settings']);
  return true;
}
