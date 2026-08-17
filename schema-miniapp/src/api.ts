import type { QuickPracticeId } from '../../shared/src/practices/quickPractices';
// Типы, чьи методы переехали в shared-фабрику, здесь остались только ре-экспортом.
export type {
  UserSchemaNote,
  UserModeNote,
} from '../../shared/src/notes/types';
import { exercisesApi } from './apiExercises';
import {
  buildSharedApi,
  type ApiTransport,
} from '../../shared/src/api/sharedApi';
import { createRatingApi } from '../../shared/src/api/ratingApi';
import { createClientErrorReporter } from '../../shared/src/api/clientErrorReport';
import { BASE, authedFetch, get, post, postJson, del } from './apiClient';
import type { UiPrefsPatch } from './utils/uiPrefsSync';

// Типы вынесены в ./apiTypes и ре-экспортируются здесь — импорты потребителей не меняются.
export * from './apiTypes';
import type { ClientConceptualization } from './apiTypes';
import type { UserSettings } from './apiTypes';

// Единственная копия — shared/src/api/clientErrorReport.ts (правило №3).
export const reportClientError = createClientErrorReporter(BASE, 'miniapp');

// Единый транспорт: общие методы приезжают из shared-фабрики (правило №3).
const transport: ApiTransport = { get, post, postJson, del };

// Оффлайн-надёжность оценки — shared/src/api/ratingApi.ts (единая реализация
// для обоих фронтендов, правило №3); `api.trackEvent` внутри — лениво (TDZ:
// `api` определится ниже, замыкание исполнится позже).
const ratingApi = createRatingApi(
  (path, init) => authedFetch(path, init),
  (name, meta) => api.trackEvent(name, meta),
);

export const api = {
  // Общие с webapp методы — из shared-фабрики (правило №3).
  ...buildSharedApi(transport),
  ...ratingApi,

  // uiPrefs — только мини-апп (utils/uiPrefsSync.ts), тип локальный поверх shared.
  getSettings: () =>
    get<UserSettings & { uiPrefs?: UiPrefsPatch | null }>('/api/settings'),
  updateSettings: (body: Partial<UserSettings> & { uiPrefs?: UiPrefsPatch }) =>
    post('/api/settings', body),

  // Случайная фраза Здорового взрослого (пул канала; готовый контент).
  getHealthyPhrase: () => get<{ text: string | null }>('/api/healthy-phrase'),
  // ─── Case Conceptualization ──────────────────────────────────────────────────
  getConceptualization: (clientId: number) =>
    get<ClientConceptualization | null>(
      `/api/therapy/conceptualization/${clientId}`,
    ),
  saveConceptualization: (
    clientId: number,
    body: {
      schemaIds?: string[];
      modeIds?: string[];
      earlyExperience?: string;
      unmetNeeds?: string;
      triggers?: string;
      copingStyles?: string;
      goals?: string;
      currentProblems?: string;
      modeTransitions?: string;
    },
  ) =>
    postJson<ClientConceptualization>(
      `/api/therapy/conceptualization/${clientId}`,
      body,
    ),
  ...exercisesApi,
  // ─── Быстрые практики «Здесь и сейчас» (дыхание/заземление/«Стоп») ─────────────
  recordPracticeSession: (tool: QuickPracticeId) =>
    postJson<{ ok: true; count: number }>('/api/practice-session', { tool }),
  // Форма ответа выражена через QuickPracticeId — отдельный интерфейс в
  // apiTypes.ts не заводим: тот файл потокенно зеркалит api.ts и уже висит
  // в jscpd-храповике как клон, каждая новая строка удлиняет дубль.
  getPracticeSessions: () =>
    get<Record<QuickPracticeId, number>>('/api/practice-sessions'),
  // saveRating/flushOutbox (outbox — см. ../../shared/src/utils/ratingOutbox.ts)
  // приезжают через ...ratingApi выше. Вызывается при старте приложения и
  // при возврате online — см. App.tsx.
};
