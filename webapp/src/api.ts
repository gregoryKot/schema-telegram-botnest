// Shared API client for the web app.
// Uses Authorization: Bearer <token> instead of x-telegram-init-data.
import type {
  Need,
  UserProfile,
  DayHistory,
  EmotionEntry,
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
  TherapyClientSummary,
} from '../../shared/src/types';
// Единственная фронтовая копия типа — в shared (правило №3).
export type { TherapyClientSummary } from '../../shared/src/types';
import type { QuizDto } from '../../shared/src/quiz/quizEngine';
export type { QuizDto } from '../../shared/src/quiz/quizEngine';
import type {
  UserSchemaNote,
  UserModeNote,
  SaveSchemaNoteBody,
  SaveModeNoteBody,
} from '../../shared/src/notes/types';
export type { UserSchemaNote, UserModeNote } from '../../shared/src/notes/types';
import { telemetryUrl } from './utils/telemetryUrl';

const rawBase = (import.meta.env.VITE_API_URL as string) ?? '';
const BASE = rawBase && !rawBase.startsWith('http') ? `https://${rawBase}` : rawBase;

let _getToken: (() => string | null) | null = null;

export function setTokenProvider(fn: () => string | null) {
  _getToken = fn;
}

function authHeaders(): Record<string, string> {
  const token = _getToken?.();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

async function fetchWithTimeout(input: string, init: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, credentials: 'include' });
  } finally {
    clearTimeout(id);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try { const j = await res.json(); if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message); } catch { /* best-effort: ошибку намеренно игнорируем */ }
    throw new Error(msg);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try { const j = await res.json(); if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message); } catch { /* best-effort: ошибку намеренно игнорируем */ }
    throw new Error(msg);
  }
  return res.json();
}

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
        source: 'webapp',
        // H0 (аудит 2026-07-20): ТОЛЬКО путь, без query/fragment. После логина
        // вебапп попадает на `/auth/callback#access_token=<JWT>` (TTL 15 мин),
        // а хеш чистится лишь в useEffect — краш на фазе рендера успевал
        // отправить токен в логи сервера и в DM админа.
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

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try { const j = await res.json(); if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message); } catch { /* best-effort: ошибку намеренно игнорируем */ }
    throw new Error(msg);
  }
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

// Admin booking requests: the admin key goes in the x-admin-key header so it
// never appears in URLs or server access logs.
async function adminReq<T>(method: string, path: string, key: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let msg = `API error: ${res.status}`;
    try { const j = await res.json(); if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message); } catch { /* best-effort: ошибку намеренно игнорируем */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json().catch(() => undefined as T);
}

import type {
  UserSettings,
  StreakData,
  Achievement,
  BookingSlot,
  SessionOption,
  AvailabilityRule,
  NewAvailabilityRule,
  AdminBooking,
  AdminBookingStatus,
  ArticleSummary,
  Article,
  ArticleDto,
  MarqueeTopic,
  HealthyAdultPhrase,
  HealthyAdultPoolStatus,
  SiteContent,
  UserPractice,
  PairsData,
  PracticePlan,
  UserTask,
  TherapyRelationInfo,
  TherapistNote,
  TherapistCustomMode,
  ModeMapKind,
  ModeMapMeta,
  ModeMapFull,
  ClientConceptualization,
  YsqHistoryEntry,
  ClientData,
  BeliefCheckEntry,
  LetterEntry,
  FlashcardEntry,
  Insights,
} from './api.types';
export type {
  UserSettings,
  StreakData,
  Achievement,
  BookingSlot,
  SessionOption,
  AvailabilityRule,
  NewAvailabilityRule,
  AdminBooking,
  AdminBookingStatus,
  ArticleSummary,
  Article,
  ArticleDto,
  MarqueeTopic,
  HealthyAdultPhrase,
  HealthyAdultPoolStatus,
  SiteContent,
  UserPractice,
  PartnerInfo,
  PairsData,
  PracticePlan,
  UserTask,
  TherapyRelationInfo,
  TherapistNote,
  ConceptSnapshot,
  TherapistCustomMode,
  ModeMapNode,
  EdgeType,
  LineStyle,
  ModeMapEdge,
  ModeMapKind,
  ModeMapMeta,
  ModeMapFull,
  ClientConceptualization,
  YsqHistoryEntry,
  ClientData,
  BeliefCheckEntry,
  LetterEntry,
  FlashcardEntry,
  Insights,
} from './api.types';
// ─── API object (identical endpoints, different auth header) ──────────────────
export const api = {
  init:           (tzOffset?: number) => post('/api/init', { tzOffset }),

  // Продуктовая аналитика (правило №8). Fire-and-forget: аналитика НИКОГДА не
  // влияет на UX — ошибки/сеть глотаем, промис не пробрасываем.
  trackEvent: (name: string, meta?: Record<string, unknown>): void => {
    void post('/api/event', { name, meta }).catch(() => undefined);
  },

  // Публичные вызовы БЕЗ auth (лид-магнит): контент тестов из quiz-registry и
  // анонимная аналитика — мини-тесты и клики лендинга (userId = null).
  getQuizzes: (form?: 'ty' | 'vy') =>
    get<{ quizzes: QuizDto[] }>(`/api/quizzes${form === 'vy' ? '?form=vy' : ''}`),
  trackPublicEvent: (name: string, meta?: Record<string, unknown>): void => {
    void post('/api/public-event', { name, meta }).catch(() => undefined);
  },
  getDisclaimer:  () => get<{ accepted: boolean }>('/api/disclaimer'),
  acceptDisclaimer: () => post('/api/disclaimer', {}),
  getYsqProgress: () => get<{ answers: number[]; page: number } | null>('/api/ysq-progress'),
  saveYsqProgress: (answers: number[], page: number) => post('/api/ysq-progress', { answers, page }),
  deleteYsqProgress: () => del('/api/ysq-progress'),
  needs:          () => get<Need[]>('/api/needs'),
  ratings:        (date?: string) => get<Record<string, number>>(`/api/ratings${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  saveRating:     async (needId: string, value: number, date?: string): Promise<{ ok: boolean; allDone: boolean; streak?: StreakData }> => {
    const res = await fetch(`${BASE}/api/rating`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ needId, value, date }), credentials: 'include' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  history:        (days = 7) => get<DayHistory[]>(`/api/history?days=${days}`),
  getSettings:    () => get<UserSettings>('/api/settings'),
  updateSettings: (body: Partial<UserSettings>) => post('/api/settings', body),
  getAchievements: () => get<Achievement[]>('/api/achievements'),
  getNote:         (date: string) => get<{ text: string | null; tags: string[] }>(`/api/note?date=${date}`),
  saveNote:        (date: string, text: string, tags?: string[]) => post('/api/note', { date, text, tags }),
  getStreak:      () => get<StreakData>('/api/streak'),
  recordActivity: () => post('/api/activity', {}),
  getInsights:    () => get<Insights>('/api/insights'),
  getExport:      () => get<{ text: string }>('/api/export'),
  getJourney:     () => get<import('../../shared/src/journey/journeyMeta').JourneyData>('/api/journey'),
  getPractices:   (needId: string) => get<UserPractice[]>(`/api/practices?needId=${needId}`),
  addPractice:    (needId: string, text: string) => post('/api/practices', { needId, text }),
  deletePractice: (id: number) => del(`/api/practices/${id}`),
  deleteAllUserData: () => del('/api/user'),
  getPendingPlans: () => get<PracticePlan[]>('/api/plan/pending'),
  getPlanHistory:  (days = 30) => get<PracticePlan[]>(`/api/plans/history?days=${days}`),
  createPlan:      (needId: string, practiceText: string, reminderUtcHour?: number) => post('/api/plan', { needId, practiceText, reminderUtcHour }),
  checkinPlan:     (id: number, done: boolean) => post(`/api/plan/${id}/checkin`, { done }),
  getPair:         () => get<PairsData>('/api/pair'),
  createPairInvite: async () => {
    const res = await fetch(`${BASE}/api/pair/invite`, { method: 'POST', headers: authHeaders(), body: '{}', credentials: 'include' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<{ code: string; url: string }>;
  },
  joinPair:        (code: string) => post('/api/pair/join', { code }),
  leavePair:       async (code: string) => {
    const res = await fetch(`${BASE}/api/pair`, { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ code }), credentials: 'include' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  getChildhoodRatings:  () => get<Record<string, number>>('/api/childhood-ratings'),
  saveChildhoodRatings: (ratings: Record<string, number>) => post('/api/childhood-ratings', ratings),
  getYsqResult:    () => get<{ answers: number[]; completedAt: string } | null>('/api/ysq-result'),
  saveYsqResult:   (answers: number[]) => post('/api/ysq-result', { answers }),
  deleteYsqResult: () => del('/api/ysq-result'),
  getYsqHistory:   () => get<YsqHistoryEntry[]>('/api/ysq-history'),
  getProfile:      () => get<UserProfile>('/api/profile'),
  updateName:      (name: string) => postJson<{ ok: boolean }>('/api/profile/name', { name }),
  getSchemaDiary:    () => get<SchemaDiaryEntry[]>('/api/diary/schema'),
  createSchemaDiary: (data: { trigger: string; emotions: EmotionEntry[]; thoughts?: string; bodyFeelings?: string; actualBehavior?: string; schemaIds: string[]; schemaOrigin?: string; healthyView?: string; realProblems?: string; excessiveReactions?: string; healthyBehavior?: string }) => postJson<SchemaDiaryEntry>('/api/diary/schema', data),
  deleteSchemaDiary: (id: number) => del(`/api/diary/schema/${id}`),
  getModeDiary:      () => get<ModeDiaryEntry[]>('/api/diary/mode'),
  createModeDiary:   (data: { modeId: string; situation: string; thoughts?: string; feelings?: string; bodyFeelings?: string; actions?: string; actualNeed?: string; childhoodMemories?: string; healthyResponse?: string }) => postJson<ModeDiaryEntry>('/api/diary/mode', data),
  deleteModeDiary:   (id: number) => del(`/api/diary/mode/${id}`),
  getGratitudeDiary:    () => get<GratitudeDiaryEntry[]>('/api/diary/gratitude'),
  createGratitudeDiary: (date: string, items: string[]) => postJson<GratitudeDiaryEntry>('/api/diary/gratitude', { date, items }),
  deleteGratitudeDiary: (id: number) => del(`/api/diary/gratitude/${id}`),
  createTherapyInvite:  () => postJson<{ code: string; url: string }>('/api/therapy/invite', {}),
  getTherapyRelation:   () => get<TherapyRelationInfo | null>('/api/therapy/relation'),
  joinTherapy:          (code: string) => post('/api/therapy/join', { code }),
  leaveTherapy:         () => del('/api/therapy/relation'),
  getTherapyClients:    () => get<TherapyClientSummary[]>('/api/therapy/clients'),
  addClientManually:    (clientTelegramId: number) => postJson<TherapyClientSummary[]>('/api/therapy/clients/add', { clientTelegramId }),
  addVirtualClient:     (name: string) => postJson<TherapyClientSummary[]>('/api/therapy/clients/virtual', { name }),
  removeClient:         (clientId: number) => del(`/api/therapy/clients/${clientId}`),
  renameClient:         (clientId: number, alias: string) => post(`/api/therapy/rename-client/${clientId}`, { alias }),
  requestYsq:           (clientId: number) => post(`/api/therapy/request-ysq/${clientId}`, {}),
  becomeTherapist:      (code: string) => postJson<{ ok: boolean }>('/api/therapy/become-therapist', { code }),
  getTherapistRequest:  () => get<{ id: number; status: string; rejectReason: string | null } | null>('/api/therapy/request'),
  submitTherapistRequest: (body: { fullName: string; qualification: string; contacts: string; message?: string }) =>
    postJson<{ ok: boolean }>('/api/therapy/request', body),
  setTherapistView:     (on: boolean) => postJson<{ ok: boolean }>('/api/therapy/therapist-view', { on }),
  resignTherapist:      () => del('/api/therapy/therapist-role'),
  createTask:           (body: { type: string; text: string; targetDays?: number; needId?: string; dueDate?: string; clientId?: number }) => postJson<UserTask>('/api/therapy/tasks', body),
  getTasks:             () => get<UserTask[]>('/api/therapy/tasks'),
  getTaskHistory:       () => get<UserTask[]>('/api/therapy/tasks/history'),
  completeTask:         (id: number, done: boolean) => post(`/api/therapy/tasks/${id}/complete`, { done }),
  getTherapyTasksForClient: (clientId: number) => get<UserTask[]>(`/api/therapy/tasks/client/${clientId}`),
  getAllTherapyTasks:       () => get<{ clientId: number; clientName: string; tasks: UserTask[] }[]>('/api/therapy/tasks/all'),
  getTherapistNotes:    (clientId: number) => get<TherapistNote[]>(`/api/therapy/notes/${clientId}`),
  createTherapistNote:  (clientId: number, date: string, text: string) => postJson<TherapistNote>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote:  (noteId: number) => del(`/api/therapy/notes/${noteId}`),
  getConceptualization: (clientId: number) => get<ClientConceptualization | null>(`/api/therapy/conceptualization/${clientId}`),
  saveConceptualization: (clientId: number, body: Partial<Omit<ClientConceptualization, 'id' | 'therapistId' | 'clientId' | 'history' | 'updatedAt'>>) => postJson<ClientConceptualization>(`/api/therapy/conceptualization/${clientId}`, body),
  updateSessionInfo:    (clientId: number, body: { therapyStartDate?: string | null; nextSession?: string | null; meetingDays?: number[] }) => post(`/api/therapy/session-info/${clientId}`, body),
  getTherapyClientData: (clientId: number) => get<ClientData>(`/api/therapy/client-data/${clientId}`),
  getTherapyClientHistory: (clientId: number) => get<{ date: string; index: number | null; ratings: Record<string, number> }[]>(`/api/therapy/client-history/${clientId}`),
  getSchemaNotes:       () => get<UserSchemaNote[]>('/api/schema-notes'),
  saveSchemaNote:       (body: SaveSchemaNoteBody) => post('/api/schema-notes', body),
  getModeNotes:         () => get<UserModeNote[]>('/api/mode-notes'),
  saveModeNote:         (body: SaveModeNoteBody) => post('/api/mode-notes', body),
  // Разборы фразы (упражнение «Критик или забота?» живёт в мини-аппе) — сайту
  // нужны для «Тёплых слов»: в коллекцию идут помеченные inWarmWords.
  getPhraseChecks:      () => get<Array<{ id: number; rewrite: string | null; inWarmWords: boolean; createdAt: string }>>('/api/phrase-checks'),
  getBeliefChecks:      () => get<BeliefCheckEntry[]>('/api/belief-checks'),
  createBeliefCheck:    (body: { belief: string; evidenceFor: string[]; evidenceAgainst: string[]; reframe?: string }) => post('/api/belief-checks', body),
  deleteBeliefCheck:    (id: number) => del(`/api/belief-checks/${id}`),
  getLetters:           () => get<LetterEntry[]>('/api/letters'),
  createLetter:         (text: string) => post('/api/letters', { text }),
  deleteLetter:         (id: number) => del(`/api/letters/${id}`),
  getSafePlace:         () => get<{ description: string; updatedAt: string } | null>('/api/safe-place'),
  saveSafePlace:        (description: string) => post('/api/safe-place', { description }),
  getFlashcards:        () => get<FlashcardEntry[]>('/api/flashcards'),
  createFlashcard:      (body: { modeId: string; needId: string; reflection?: string; action?: string }) => post('/api/flashcards', body),
  deleteFlashcard:      (id: number) => del(`/api/flashcards/${id}`),
  getClientSchemaNotes: (clientId: number) => get<UserSchemaNote[]>(`/api/therapy/client/${clientId}/schema-notes`),
  getClientModeNotes:   (clientId: number) => get<UserModeNote[]>(`/api/therapy/client/${clientId}/mode-notes`),
  getClientDiary:       (clientId: number) => get<{ type: 'schema' | 'mode' | 'gratitude'; date: string; schemaIds?: string[]; modeId?: string; excerpt: string }[]>(`/api/therapy/client/${clientId}/diary`),
  submitBooking:        (body: { name: string; contact: string; message?: string; source?: string }) => postJson<{ ok: true }>('/api/booking', body),
  // Slot-based booking
  getBookingOptions:    () => get<SessionOption[]>('/api/booking/options'),
  getSlots:             (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return get<BookingSlot[]>(`/api/booking/slots${qs ? `?${qs}` : ''}`);
  },
  bookSlot:             (body: { startsAt: string; durationMin?: number; type?: 'INTRO_15' | 'SESSION_50'; clientName: string; clientContact: string; message?: string; returning?: boolean; acceptedOffer?: boolean; website?: string; source?: string }) =>
    postJson<{ id: number; cancelToken: string; heldUntil: string | null; status: string; paymentUrl?: string | null; meetingUrl?: string | null }>('/api/booking/book', body),
  getBookingByToken:    (token: string) => get<{ status: string; type: 'INTRO_15' | 'SESSION_50'; startsAt: string; endsAt: string; durationMin: number; meetingUrl: string | null }>(`/api/booking/by-token/${token}`),
  cancelBooking:        (token: string) => postJson<{ ok: true }>(`/api/booking/cancel/${token}`, {}),
  donate:               (body: { amount: number; source?: 'app' | 'game'; email?: string; comment?: string; website?: string }) =>
    postJson<{ id: number; paymentUrl: string | null }>('/api/donation', body),
  // Subscription (recurring support)
  getSubscriptionOptions: () => get<{ enabled: boolean; options: { period: 'month' | 'year'; price: number }[] }>('/api/subscription/options'),
  subscribe:            (body: { period: 'month' | 'year'; email?: string; acceptedOffer?: boolean; website?: string }) =>
    postJson<{ id: number; cancelToken: string; paymentUrl: string | null }>('/api/subscription', body),
  getSubscriptionByToken: (token: string) => get<{ status: string; period: string; amount: number; nextChargeAt: string | null }>(`/api/subscription/by-token/${token}`),
  cancelSubscription:   (token: string) => postJson<{ ok: true }>(`/api/subscription/cancel/${token}`, {}),
  // Booking admin — key travels in the x-admin-key header (never in URL/logs)
  adminStatus:       (key: string) => adminReq<AdminBookingStatus>('GET', '/api/booking/admin/status', key),
  adminGetPrices:    (key: string) => adminReq<SessionOption[]>('GET', '/api/booking/admin/prices', key),
  adminSetPrice:     (key: string, type: 'INTRO_15' | 'SESSION_50', amount: number) => adminReq<{ ok: true }>('PATCH', '/api/booking/admin/price', key, { type, amount }),
  adminGetSubPrices: (key: string) => adminReq<{ period: 'month' | 'year'; price: number }[]>('GET', '/api/booking/admin/sub-prices', key),
  adminSetSubPrice:  (key: string, period: 'month' | 'year', amount: number) => adminReq<{ ok: true }>('PATCH', '/api/booking/admin/sub-price', key, { period, amount }),
  adminListRules:    (key: string) => adminReq<AvailabilityRule[]>('GET', '/api/booking/admin/rules', key),
  adminCreateRule:   (key: string, rule: NewAvailabilityRule) => adminReq<AvailabilityRule>('POST', '/api/booking/admin/rules', key, rule),
  adminToggleRule:   (key: string, id: number, isActive: boolean) => adminReq<AvailabilityRule>('PATCH', `/api/booking/admin/rules/${id}`, key, { isActive }),
  adminDeleteRule:   (key: string, id: number) => adminReq<void>('DELETE', `/api/booking/admin/rules/${id}`, key),
  adminListBookings: (key: string, filter: 'upcoming' | 'past' | 'cancelled' | 'all' = 'upcoming') =>
    adminReq<AdminBooking[]>('GET', `/api/booking/admin/list?filter=${filter}`, key),
  adminConfirm:      (key: string, id: number) => adminReq<{ ok: true }>('POST', `/api/booking/admin/confirm/${id}`, key),
  // Articles
  listArticles:      () => get<ArticleSummary[]>('/api/articles'),
  getArticle:        (slug: string) => get<Article>(`/api/articles/${slug}`),
  adminListArticles: (key: string) => adminReq<Article[]>('GET', '/api/articles/admin/list', key),
  adminCreateArticle: (key: string, dto: ArticleDto) => adminReq<Article>('POST', '/api/articles/admin', key, dto),
  adminUpdateArticle: (key: string, id: number, dto: Partial<ArticleDto>) => adminReq<Article>('PATCH', `/api/articles/admin/${id}`, key, dto),
  adminDeleteArticle: (key: string, id: number) => adminReq<void>('DELETE', `/api/articles/admin/${id}`, key),
  // Site content (hero photo, marquee topics)
  getSiteContent:    () => get<SiteContent>('/api/site-content'),
  adminSetHeroPhoto: (key: string, dataUri: string) => adminReq<{ ok: true }>('PATCH', '/api/site-content/admin/hero-photo', key, { dataUri }),
  adminSetMarquee:   (key: string, group: 'A' | 'B', topics: MarqueeTopic[]) => adminReq<{ ok: true }>('PATCH', '/api/site-content/admin/marquee', key, { group, topics }),
  // Healthy-adult channel phrases
  adminListPhrases:  (key: string) => adminReq<HealthyAdultPhrase[]>('GET', '/api/healthy-adult/admin/list', key),
  adminCreatePhrase: (key: string, text: string) => adminReq<HealthyAdultPhrase>('POST', '/api/healthy-adult/admin', key, { text }),
  adminUpdatePhrase: (key: string, id: number, patch: { text?: string; enabled?: boolean }) => adminReq<HealthyAdultPhrase>('PATCH', `/api/healthy-adult/admin/${id}`, key, patch),
  adminDeletePhrase: (key: string, id: number) => adminReq<void>('DELETE', `/api/healthy-adult/admin/${id}`, key),
  adminTestPhrasePost: (key: string) => adminReq<{ ok: boolean; message: string }>('POST', '/api/healthy-adult/admin/test-post', key, {}),
  adminImportPhrases: (key: string, text: string) => adminReq<{ created: HealthyAdultPhrase[]; message: string }>('POST', '/api/healthy-adult/admin/import', key, { text }),
  adminPhrasePoolStatus: (key: string) => adminReq<HealthyAdultPoolStatus>('GET', '/api/healthy-adult/admin/pool-status', key),
  // Therapist custom modes
  listCustomModes:   ()                               => get<TherapistCustomMode[]>('/api/therapy/custom-modes'),
  createCustomMode:  (body: { name: string; emoji?: string; nodeType?: string }) => postJson<TherapistCustomMode>('/api/therapy/custom-modes', body),
  deleteCustomMode:  (id: number)                    => del(`/api/therapy/custom-modes/${id}`),
  // Mode Maps
  listModeMaps:   (clientId: number) => get<ModeMapMeta[]>(`/api/therapy/mode-maps/${clientId}`),
  getModeMap:     (mapId: number)    => get<ModeMapFull>(`/api/therapy/mode-maps/map/${mapId}`),
  createModeMap:  (clientId: number, title: string, kind: ModeMapKind = 'problem') => postJson<ModeMapFull>(`/api/therapy/mode-maps/${clientId}`, { title, kind }),
  updateModeMap:  (mapId: number, body: Partial<Pick<ModeMapFull, 'title' | 'nodes' | 'edges'>>) => patchJson<ModeMapFull>(`/api/therapy/mode-maps/map/${mapId}`, body),
  deleteModeMap:  (mapId: number) => del(`/api/therapy/mode-maps/map/${mapId}`),
  // Client read-only view of their own maps
  listMyModeMaps: () => get<ModeMapMeta[]>('/api/therapy/my-mode-maps'),
  getMyModeMap:   (mapId: number) => get<ModeMapFull>(`/api/therapy/my-mode-maps/${mapId}`),
};
