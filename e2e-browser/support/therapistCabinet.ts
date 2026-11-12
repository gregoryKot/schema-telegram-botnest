// Кабинет терапевта в браузерном смоке: тот же стаб формы сервера (stubApi), поверх — ответы
// для терапевта с одним офлайн-клиентом через `api.overrides` (ключ — метод и путь, как в FIXTURES).
// Формы — shared/src/types.ts (TherapyClientSummary), shared/src/apiTypes.ts (UserTask, ClientData),
// shared/src/therapy/notesPage.ts. Минимум, который нужен карточке клиента без ответа 404.
import type { Page } from '@playwright/test';
import type { StubApiHandle } from './stubApi';
import { FIXTURES } from './stubFixtures';

/** Офлайн-клиент (отрицательный id): терапевт сам отмечает его задания выполненными — у строки и «Выполнено», и корзина. */
export const OFFLINE_CLIENT = {
  telegramId: -57,
  urlCode: 'ghjkmnpq',
  name: 'Елена',
  clientAlias: 'Елена',
  streak: 0,
  lastActiveDate: null,
  daysSinceActive: null,
  todayIndex: null,
  recentIndexHistory: Array(14).fill(null),
  relationCreatedAt: '2026-08-01T09:00:00.000Z',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
};

/** Задание в форме UserTask; срок далеко в будущем — статус не зависит от дня прогона. */
export const cabinetTask = (id: number, text: string) => ({
  id,
  userId: String(OFFLINE_CLIENT.telegramId),
  assignedBy: '2',
  type: 'custom',
  text,
  targetDays: null,
  needId: null,
  dueDate: '2099-01-10',
  done: null,
  completedAt: null,
  createdAt: '2026-11-01T09:00:00.000Z',
});

/** Вкладка «Задания» карточки офлайн-клиента у терапевта. */
export async function openTherapistTasks(
  page: Page,
  api: StubApiHandle,
  tasks: unknown[],
): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('therapist_privacy_disclaimer_seen', '1'); // лист «о заботе о клиентах» — не этот тест
      localStorage.setItem('why_seen_v1', '1');
    } catch {
      // about:blank до первой навигации: у документа нет хранилища.
    }
  });
  const id = OFFLINE_CLIENT.telegramId;
  const set = (key: string, body: unknown) => api.overrides.set(key, body);
  set('GET /api/profile', {
    ...(FIXTURES['GET /api/profile'] as object),
    role: 'THERAPIST',
    name: 'Марина',
  });
  set('GET /api/user-flags', {
    ...(FIXTURES['GET /api/user-flags'] as object),
    therapistMode: true,
  });
  set('POST /api/therapy/therapist-view', { ok: true });
  set('GET /api/therapy/clients', [OFFLINE_CLIENT]);
  for (const k of [
    'invites',
    'card-claims',
    'tasks/all',
    'custom-modes',
    `mode-maps/${id}`,
  ])
    set(`GET /api/therapy/${k}`, []);
  set(`GET /api/therapy/tasks/client/${id}`, tasks);
  set(`GET /api/therapy/notes/${id}`, { notes: [], total: 0 });
  set(`GET /api/therapy/conceptualization/${id}`, null);
  set(`GET /api/therapy/client-data/${id}`, {
    name: OFFLINE_CLIENT.name,
    mySchemaIds: [],
    myModeIds: [],
    ysqCompletedAt: null,
    ysqActiveSchemaIds: [],
    ysqHistory: [],
    ysqRequestPending: false,
    childhoodRatings: {},
  });
  for (const k of [
    `client/${id}/schema-notes`,
    `client/${id}/mode-notes`,
    `client-history/${id}`,
    `client/${id}/diary`,
  ]) {
    set(`GET /api/therapy/${k}`, []);
  }
  await page.goto(`/cabinet/${OFFLINE_CLIENT.urlCode}/tasks`);
}
