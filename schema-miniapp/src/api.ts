import { todayStr } from './utils/format';
import { OutboxItem, enqueueRating, flushRatingOutbox } from './utils/outbox';
import { telemetryUrl } from './utils/telemetryUrl';
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
import {
  BASE,
  authedFetch,
  HttpStatusError,
  get,
  post,
  postJson,
  del,
} from './apiClient';

// Типы вынесены в ./apiTypes и ре-экспортируются здесь, чтобы импорты
// потребителей из '../api' продолжали работать без изменений.
export * from './apiTypes';
import type { StreakData, ClientConceptualization } from './apiTypes';

// Отправка пойманной ErrorBoundary ошибки на бэкенд (best-practice «видимость
// прода», 2026-07). Без auth, fire-and-forget, keepalive — чтобы долетело даже
// если краш случился на выгрузке. Никогда не бросает: телеметрия не мешает UI.
export function reportClientError(payload: {
  message: string;
  section: string;
  stack?: string;
  componentStack?: string;
}): void {
  try {
    void fetch(`${BASE}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payload.message.slice(0, 500),
        section: payload.section.slice(0, 120),
        stack: payload.stack?.slice(0, 4000),
        componentStack: payload.componentStack?.slice(0, 4000),
        source: 'miniapp',
        // H0 (аудит 2026-07-20): ТОЛЬКО путь, без query/fragment. Мини-апп
        // грузится с `#tgWebAppData=…&hash=<подпись>` — это живая initData
        // (реплей 1 ч = полная имперсонация), и целиком href уезжал в логи
        // сервера и в DM админа.
        url:
          typeof location !== 'undefined'
            ? telemetryUrl(location.href)
            : undefined,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

type SaveRatingResult = { ok: boolean; allDone: boolean; streak?: StreakData };

async function rawSaveRating(item: OutboxItem): Promise<SaveRatingResult> {
  const res = await authedFetch('/api/rating', {
    method: 'POST',
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new HttpStatusError(res.status);
  return res.json() as Promise<SaveRatingResult>;
}

// Единый транспорт: общие методы приезжают из shared-фабрики (правило №3).
const transport: ApiTransport = { get, post, postJson, del };

export const api = {
  // Общие с webapp методы — из shared-фабрики (правило №3).
  ...buildSharedApi(transport),

  // Случайная фраза Здорового взрослого (пул канала; готовый контент).
  getHealthyPhrase: () => get<{ text: string | null }>('/api/healthy-phrase'),
  saveRating: async (
    needId: string,
    value: number,
    date?: string,
  ): Promise<SaveRatingResult> => {
    // Дата фиксируется здесь, на момент вызова: если отправка сорвётся в
    // сеть и уйдёт в outbox для отложенного флаша, сервер должен записать
    // именно «сегодня по мнению юзера сейчас», а не «сегодня в момент
    // флаша» (который может случиться уже на следующий день).
    const dt = date ?? todayStr();
    const item: OutboxItem = { needId, value, date: dt };
    try {
      return await rawSaveRating(item);
    } catch (err) {
      // 4xx — осмысленная ошибка (невалидные данные и т.п.), кидаем как
      // раньше. Всё остальное (сетевой обрыв, таймаут, 5xx) — оффлайн-путь:
      // кладём в outbox и отвечаем успехом (запись идемпотентна по upsert
      // на сервере, так что доедет при следующем флаше).
      const isClientError =
        err instanceof HttpStatusError && err.status >= 400 && err.status < 500;
      if (isClientError) throw err;
      enqueueRating(item);
      return { ok: true, allDone: false };
    }
  },
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
  // ─── Outbox ──────────────────────────────────────────────────────────────────
  // Отправляет отложенные оценки (см. utils/outbox.ts). Вызывается при старте
  // приложения и при возврате online — см. App.tsx.
  flushOutbox: () =>
    flushRatingOutbox(
      (item) => rawSaveRating(item).then(() => undefined),
      // Спасли записи, сделанные без интернета (правило №8), fire-and-forget.
      (count) => api.trackEvent('outbox_flush', { count }),
    ),
};
