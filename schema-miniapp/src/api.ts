import { todayStr } from './utils/format';
import { OutboxItem, enqueueRating, flushRatingOutbox } from './utils/outbox';
import { telemetryUrl } from './utils/telemetryUrl';
import type { TherapyClientSummary } from '../../shared/src/types';
import {
  BASE,
  authHeaders,
  fetchWithTimeout,
  HttpStatusError,
  get,
  post,
  postJson,
  del,
} from './apiClient';

// Типы вынесены в ./apiTypes и ре-экспортируются здесь, чтобы импорты
// потребителей из '../api' продолжали работать без изменений.
export * from './apiTypes';
import type {
  UserSettings,
  StreakData,
  Achievement,
  UserPractice,
  PairsData,
  PracticePlan,
  UserTask,
  TherapyRelationInfo,
  TherapistNote,
  ClientConceptualization,
  YsqHistoryEntry,
  ClientData,
} from './apiTypes';

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
  const res = await fetchWithTimeout(`${BASE}/api/rating`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new HttpStatusError(res.status);
  return res.json() as Promise<SaveRatingResult>;
}

export const api = {
  init: (tzOffset?: number) => post('/api/init', { tzOffset }),

  // Продуктовая аналитика (правило №8). Fire-and-forget: аналитика НИКОГДА не
  // влияет на UX — ошибки/сеть глотаем, промис не пробрасываем.
  trackEvent: (name: string, meta?: Record<string, unknown>): void => {
    void post('/api/event', { name, meta }).catch(() => undefined);
  },
  // Анонимные события (practice_link_click и т.п.) — без initData, userId=null
  // на сервере. Парно webapp.api.trackPublicEvent (правило №3).
  trackPublicEvent: (name: string, meta?: Record<string, unknown>): void => {
    void post('/api/public-event', { name, meta }).catch(() => undefined);
  },

  // Случайная фраза Здорового взрослого (пул канала; готовый контент).
  getHealthyPhrase: () => get<{ text: string | null }>('/api/healthy-phrase'),
  getDisclaimer: () => get<{ accepted: boolean }>('/api/disclaimer'),
  acceptDisclaimer: () => post('/api/disclaimer', {}),
  getYsqProgress: () =>
    get<{ answers: number[]; page: number } | null>('/api/ysq-progress'),
  saveYsqProgress: (answers: number[], page: number) =>
    post('/api/ysq-progress', { answers, page }),
  deleteYsqProgress: async () => {
    const res = await fetch(`${BASE}/api/ysq-progress`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  needs: () => get<import('./types').Need[]>('/api/needs'),
  ratings: (date?: string) =>
    get<Record<string, number>>(
      `/api/ratings${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    ),
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
  history: (days = 7) =>
    get<import('./types').DayHistory[]>(`/api/history?days=${days}`),
  getSettings: () => get<UserSettings>('/api/settings'),
  updateSettings: (body: Partial<UserSettings>) => post('/api/settings', body),
  getAchievements: () => get<Achievement[]>('/api/achievements'),
  getNote: (date: string) =>
    get<{ text: string | null; tags: string[] }>(`/api/note?date=${date}`),
  saveNote: (date: string, text: string, tags?: string[]) =>
    post('/api/note', { date, text, tags }),
  getStreak: () => get<StreakData>('/api/streak'),
  recordActivity: () => post('/api/activity', {}),
  getInsights: () =>
    get<{
      weeklyStats: Array<{
        needId: string;
        avg: number | null;
        trend: '↑' | '↓' | '→';
      }>;
      bestDayOfWeek: string | null;
      worstDayOfWeek: string | null;
      totalDays: number;
    }>('/api/insights'),
  getExport: () => get<{ text: string }>('/api/export'),
  getJourney: () =>
    get<import('../../shared/src/journey/journeyMeta').JourneyData>(
      '/api/journey',
    ),
  getPractices: (needId: string) =>
    get<UserPractice[]>(`/api/practices?needId=${needId}`),
  addPractice: (needId: string, text: string) =>
    post('/api/practices', { needId, text }),
  deletePractice: (id: number) =>
    fetch(`${BASE}/api/practices/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then((r) => {
      if (!r.ok) throw new Error(`API error: ${r.status}`);
    }),
  deleteAllUserData: () =>
    fetch(`${BASE}/api/user`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then((r) => {
      if (!r.ok) throw new Error('Failed');
    }),
  getPendingPlans: () => get<PracticePlan[]>('/api/plan/pending'),
  getPlanHistory: (days = 30) =>
    get<PracticePlan[]>(`/api/plans/history?days=${days}`),
  createPlan: (
    needId: string,
    practiceText: string,
    reminderUtcHour?: number,
  ) => post('/api/plan', { needId, practiceText, reminderUtcHour }),
  checkinPlan: (id: number, done: boolean) =>
    post(`/api/plan/${id}/checkin`, { done }),
  getPair: () => get<PairsData>('/api/pair'),
  createPairInvite: async () => {
    const res = await fetch(`${BASE}/api/pair/invite`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<{ code: string; url: string }>;
  },
  joinPair: (code: string) => post('/api/pair/join', { code }),
  leavePair: async (code: string) => {
    const res = await fetch(`${BASE}/api/pair`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  getChildhoodRatings: () =>
    get<Record<string, number>>('/api/childhood-ratings'),
  saveChildhoodRatings: (ratings: Record<string, number>) =>
    post('/api/childhood-ratings', ratings),
  getYsqResult: () =>
    get<{ answers: number[]; completedAt: string } | null>('/api/ysq-result'),
  saveYsqResult: (answers: number[]) => post('/api/ysq-result', { answers }),
  deleteYsqResult: async () => {
    const res = await fetch(`${BASE}/api/ysq-result`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  getYsqHistory: () => get<YsqHistoryEntry[]>('/api/ysq-history'),

  // ─── Profile ────────────────────────────────────────────────────────────────
  getProfile: () => get<import('./types').UserProfile>('/api/profile'),
  updateName: (name: string) =>
    postJson<{ ok: boolean }>('/api/profile/name', { name }),

  // ─── Diary ──────────────────────────────────────────────────────────────────
  getSchemaDiary: () =>
    get<import('./types').SchemaDiaryEntry[]>('/api/diary/schema'),
  createSchemaDiary: (data: {
    trigger: string;
    emotions: import('./types').EmotionEntry[];
    thoughts?: string;
    bodyFeelings?: string;
    actualBehavior?: string;
    schemaIds: string[];
    schemaOrigin?: string;
    healthyView?: string;
    realProblems?: string;
    excessiveReactions?: string;
    healthyBehavior?: string;
  }) => postJson<import('./types').SchemaDiaryEntry>('/api/diary/schema', data),
  deleteSchemaDiary: (id: number) => del(`/api/diary/schema/${id}`),

  getModeDiary: () =>
    get<import('./types').ModeDiaryEntry[]>('/api/diary/mode'),
  createModeDiary: (data: {
    modeId: string;
    situation: string;
    thoughts?: string;
    feelings?: string;
    bodyFeelings?: string;
    actions?: string;
    actualNeed?: string;
    childhoodMemories?: string;
    healthyResponse?: string;
  }) => postJson<import('./types').ModeDiaryEntry>('/api/diary/mode', data),
  deleteModeDiary: (id: number) => del(`/api/diary/mode/${id}`),

  getGratitudeDiary: () =>
    get<import('./types').GratitudeDiaryEntry[]>('/api/diary/gratitude'),
  createGratitudeDiary: (date: string, items: string[]) =>
    postJson<import('./types').GratitudeDiaryEntry>('/api/diary/gratitude', {
      date,
      items,
    }),
  deleteGratitudeDiary: (id: number) => del(`/api/diary/gratitude/${id}`),

  // ─── Therapy / Tasks ─────────────────────────────────────────────────────────
  createTherapyInvite: () =>
    postJson<{ code: string; url: string }>('/api/therapy/invite', {}),
  getTherapyRelation: () =>
    get<TherapyRelationInfo | null>('/api/therapy/relation'),
  joinTherapy: (code: string) => post('/api/therapy/join', { code }),
  leaveTherapy: () => del('/api/therapy/relation'),
  getTherapyClients: () => get<TherapyClientSummary[]>('/api/therapy/clients'),
  addClientManually: (clientTelegramId: number) =>
    postJson<TherapyClientSummary[]>('/api/therapy/clients/add', {
      clientTelegramId,
    }),
  addVirtualClient: (name: string) =>
    postJson<TherapyClientSummary[]>('/api/therapy/clients/virtual', { name }),
  removeClient: (clientId: number) => del(`/api/therapy/clients/${clientId}`),
  renameClient: (clientId: number, alias: string) =>
    post(`/api/therapy/rename-client/${clientId}`, { alias }),
  requestYsq: (clientId: number) =>
    post(`/api/therapy/request-ysq/${clientId}`, {}),
  becomeTherapist: (code: string) =>
    postJson<{ ok: boolean }>('/api/therapy/become-therapist', { code }),
  getTherapistRequest: () =>
    get<{ id: number; status: string; rejectReason: string | null } | null>(
      '/api/therapy/request',
    ),
  submitTherapistRequest: (body: {
    fullName: string;
    qualification: string;
    contacts: string;
    message?: string;
  }) => postJson<{ ok: boolean }>('/api/therapy/request', body),
  // Запомнить предпочтение старта терапевта (кабинет vs клиентский режим).
  setTherapistView: (on: boolean) =>
    postJson<{ ok: boolean }>('/api/therapy/therapist-view', { on }),
  // Отказаться от роли терапевта → снова CLIENT.
  resignTherapist: () => del('/api/therapy/therapist-role'),
  createTask: (body: {
    type: string;
    text: string;
    targetDays?: number;
    needId?: string;
    dueDate?: string;
    clientId?: number;
  }) => postJson<UserTask>('/api/therapy/tasks', body),
  getTasks: () => get<UserTask[]>('/api/therapy/tasks'),
  getTaskHistory: () => get<UserTask[]>('/api/therapy/tasks/history'),
  completeTask: (id: number, done: boolean) =>
    post(`/api/therapy/tasks/${id}/complete`, { done }),
  getTherapyTasksForClient: (clientId: number) =>
    get<UserTask[]>(`/api/therapy/tasks/client/${clientId}`),

  // ─── Therapist Notes ─────────────────────────────────────────────────────────
  getTherapistNotes: (clientId: number) =>
    get<TherapistNote[]>(`/api/therapy/notes/${clientId}`),
  createTherapistNote: (clientId: number, date: string, text: string) =>
    postJson<TherapistNote>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote: (noteId: number) => del(`/api/therapy/notes/${noteId}`),

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
  updateSessionInfo: (
    clientId: number,
    body: {
      therapyStartDate?: string | null;
      nextSession?: string | null;
      meetingDays?: number[];
    },
  ) => post(`/api/therapy/session-info/${clientId}`, body),

  // ─── Client YSQ / profile data ───────────────────────────────────────────────
  getTherapyClientData: (clientId: number) =>
    get<ClientData>(`/api/therapy/client-data/${clientId}`),

  // ─── Schema & Mode Notes ─────────────────────────────────────────────────────
  getSchemaNotes: () =>
    get<
      Array<{
        schemaId: string;
        triggers: string;
        feelings: string;
        thoughts: string;
        origins: string;
        reality: string;
        healthyView: string;
        behavior: string;
      }>
    >('/api/schema-notes'),
  saveSchemaNote: (body: {
    schemaId: string;
    triggers?: string;
    feelings?: string;
    thoughts?: string;
    origins?: string;
    reality?: string;
    healthyView?: string;
    behavior?: string;
  }) => post('/api/schema-notes', body),
  getModeNotes: () =>
    get<
      Array<{
        modeId: string;
        triggers: string;
        feelings: string;
        thoughts: string;
        needs: string;
        behavior: string;
      }>
    >('/api/mode-notes'),
  saveModeNote: (body: {
    modeId: string;
    triggers?: string;
    feelings?: string;
    thoughts?: string;
    needs?: string;
    behavior?: string;
  }) => post('/api/mode-notes', body),

  // ─── Exercises ───────────────────────────────────────────────────────────────
  getBeliefChecks: () =>
    get<
      Array<{
        id: number;
        belief: string;
        evidenceFor: string[];
        evidenceAgainst: string[];
        reframe: string | null;
        createdAt: string;
      }>
    >('/api/belief-checks'),
  createBeliefCheck: (body: {
    belief: string;
    evidenceFor: string[];
    evidenceAgainst: string[];
    reframe?: string;
  }) => post('/api/belief-checks', body),
  deleteBeliefCheck: (id: number) => del(`/api/belief-checks/${id}`),

  getLetters: () =>
    get<Array<{ id: number; text: string; createdAt: string }>>('/api/letters'),
  createLetter: (text: string) => post('/api/letters', { text }),
  deleteLetter: (id: number) => del(`/api/letters/${id}`),

  getSafePlace: () =>
    get<{ description: string; updatedAt: string } | null>('/api/safe-place'),
  saveSafePlace: (description: string) =>
    post('/api/safe-place', { description }),

  getFlashcards: () =>
    get<
      Array<{
        id: number;
        modeId: string;
        needId: string;
        reflection: string | null;
        action: string | null;
        createdAt: string;
      }>
    >('/api/flashcards'),
  createFlashcard: (body: {
    modeId: string;
    needId: string;
    reflection?: string;
    action?: string;
  }) => post('/api/flashcards', body),
  deleteFlashcard: (id: number) => del(`/api/flashcards/${id}`),

  // ─── Therapist client notes ──────────────────────────────────────────────────
  getClientSchemaNotes: (clientId: number) =>
    get<
      Array<{
        schemaId: string;
        triggers: string;
        feelings: string;
        thoughts: string;
        origins: string;
        reality: string;
        healthyView: string;
        behavior: string;
      }>
    >(`/api/therapy/client/${clientId}/schema-notes`),
  getClientModeNotes: (clientId: number) =>
    get<
      Array<{
        modeId: string;
        triggers: string;
        feelings: string;
        thoughts: string;
        needs: string;
        behavior: string;
      }>
    >(`/api/therapy/client/${clientId}/mode-notes`),

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
