// Кабинет терапевта в браузерном смоке: тот же стаб формы сервера (stubApi), поверх — ответы
// терапевту с одним офлайн-клиентом через `api.overrides` (ключ — метод и путь, как в FIXTURES).
// Список клиентов, карточка и «Графические карты»; каждую ручку сверяет с сервером
// test/browser-stub-contract.e2e-spec.ts: терапевт и офлайн-клиент там заводятся настоящими ручками.
import type { Page } from '@playwright/test';
import type { StubApiHandle } from './stubApi';
import { FIXTURES } from './stubFixtures';

/** Имя терапевта в профиле — User.firstName. */
export const THERAPIST_NAME = 'Марина';

/** Офлайн-клиент (id — минус id связи): терапевт сам отмечает его задания выполненными. */
export const OFFLINE_CLIENT = {
  telegramId: -57,
  urlCode: 'ghjkmnpq',
  name: 'Елена',
  clientAlias: null,
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
const id = OFFLINE_CLIENT.telegramId;

/**
 * Ответы терапевту поверх FIXTURES чистого клиента: роль, список из офлайн-клиента, ручки его
 * карточки и «Графические карты» без карт. Номер клиента в пути сверка заменяет настоящим.
 */
export const CABINET_FIXTURES: Record<string, unknown> = {
  'GET /api/profile': {
    ...(FIXTURES['GET /api/profile'] as object),
    role: 'THERAPIST',
    name: THERAPIST_NAME,
  },
  // Роль и therapistMode ставит одобрение заявки (src/therapy/therapist-request.service.ts).
  'GET /api/user-flags': {
    ...(FIXTURES['GET /api/user-flags'] as object),
    therapistMode: true,
  },
  'POST /api/therapy/therapist-view': { ok: true },
  'GET /api/therapy/clients': [OFFLINE_CLIENT],
  'GET /api/therapy/invites': [],
  'GET /api/therapy/card-claims': [],
  'GET /api/therapy/tasks/all': [],
  'GET /api/therapy/custom-modes': [],
  [`GET /api/therapy/mode-maps/${id}`]: [],
  [`GET /api/therapy/tasks/client/${id}`]: [],
  [`GET /api/therapy/notes/${id}`]: { notes: [], total: 0 },
  [`GET /api/therapy/conceptualization/${id}`]: null,
  // У офлайн-клиента нет аккаунта: имени, списков и опросника сервер не отдаёт.
  [`GET /api/therapy/client-data/${id}`]: {
    name: null,
    mySchemaIds: [],
    myModeIds: [],
    ysqCompletedAt: null,
    ysqActiveSchemaIds: [],
    ysqHistory: [],
    childhoodRatings: {},
    ysqRequestPending: false,
  },
  [`GET /api/therapy/client/${id}/schema-notes`]: [],
  [`GET /api/therapy/client/${id}/mode-notes`]: [],
  [`GET /api/therapy/client-history/${id}`]: [],
  [`GET /api/therapy/client/${id}/diary`]: [],
  [`GET /api/therapy/plan/${id}`]: [],
  [`GET /api/therapy/path/${id}`]: { path: null },
  [`GET /api/therapy/guide-marks/${id}`]: { marks: [] },
};

/** Сессия терапевта с офлайн-клиентом; листы первого входа уже видены. Зовётся до goto. */
export async function asTherapist(
  page: Page,
  api: StubApiHandle,
): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('therapist_privacy_disclaimer_seen', '1');
      localStorage.setItem('why_seen_v1', '1');
    } catch {
      // about:blank до первой навигации: у документа нет хранилища.
    }
  });
  for (const [key, body] of Object.entries(CABINET_FIXTURES))
    api.overrides.set(key, body);
}

/** Задание в форме UserTask; срок далеко в будущем — статус не зависит от дня прогона. */
export const cabinetTask = (taskId: number, text: string) => ({
  id: taskId,
  userId: String(id),
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
  await asTherapist(page, api);
  api.overrides.set(`GET /api/therapy/tasks/client/${id}`, tasks);
  await page.goto(`/cabinet/${OFFLINE_CLIENT.urlCode}/tasks`);
}
