// Shared API client for the web app.
// Uses Authorization: Bearer <token> instead of x-telegram-init-data.
// Единственная фронтовая копия типов — в shared (правило №3); методы, которые
// их используют, переехали в shared-фабрику, здесь остались только ре-экспорты.
export type { TherapyClientSummary } from '../../shared/src/types';
import type { QuizDto } from '../../shared/src/quiz/quizEngine';
export type { QuizDto } from '../../shared/src/quiz/quizEngine';
export type { UserSchemaNote, UserModeNote } from '../../shared/src/notes/types';
import type { PhraseMarkId } from '../../shared/src/phraseCheck/criteria';
import { buildSharedApi, type ApiTransport } from '../../shared/src/api/sharedApi';
import { createRatingApi } from '../../shared/src/api/ratingApi';
import { createClientErrorReporter } from '../../shared/src/api/clientErrorReport';

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

// Ошибка HTTP-ответа со статусом ПОЛЕМ, а не подстрокой в message: потребители
// (ArticlePage: «настоящий 404 или сеть?») ветвятся по `status`, поэтому текст
// message можно улучшать серверным `message` без слома этих проверок. Зеркало
// HttpStatusError мини-аппа (apiClient.ts, правило №3); явное поле вместо
// параметр-свойства — erasableSyntaxOnly в tsc -b.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Текст ошибки — из поля `message` тела, если распарсилось, иначе код статуса.
// Тело может прийти не-JSON (502 от прокси, оборванное соединение) — тогда
// остаётся код статуса; глушим только попытку его прочитать, не саму ошибку.
async function apiError(res: Response): Promise<ApiError> {
  let msg = `API error: ${res.status}`;
  try {
    const j = await res.json();
    if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message);
  } catch {
    /* тело не распарсилось как JSON — остаётся код статуса */
  }
  return new ApiError(res.status, msg);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw await apiError(res);
  return res.json();
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res);
  return res.json();
}

// Единственная копия — shared/src/api/clientErrorReport.ts (правило №3).
export const reportClientError = createClientErrorReporter(BASE, 'webapp');

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiError(res);
  return res.json();
}

async function del(path: string, body?: unknown): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders(), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!res.ok) throw await apiError(res);
}

// Admin booking requests: the admin key goes in the x-admin-key header so it
// never appears in URLs or server access logs.
async function adminReq<T>(method: string, path: string, key: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw await apiError(res);
  if (res.status === 204) return undefined as T;
  return res.json().catch(() => undefined as T);
}

import type {
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
  AuditedPhrase,
  HealthyAdultPhrase,
  HealthyAdultPoolStatus,
  PhraseIssue,
  SiteContent,
  UserTask,
  TherapistCustomMode,
  ModeMapKind,
  ModeMapMeta,
  ModeMapFull,
  ClientConceptualization,
  BeliefCheckEntry,
  LetterEntry,
  FlashcardEntry,
  PhraseCheckEntry,
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
  AuditedPhrase,
  HealthyAdultPhrase,
  HealthyAdultPoolStatus,
  PhraseIssue,
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
  PhraseCheckEntry,
  Insights,
} from './api.types';
// ─── API object (identical endpoints, different auth header) ──────────────────

// Единый транспорт: общие методы приезжают из shared-фабрики (правило №3).
const transport: ApiTransport = { get, post, postJson, del };

// Оффлайн-надёжность оценки — shared/src/api/ratingApi.ts (единая реализация для обоих фронтендов, правило №3); `api.trackEvent` внутри — лениво (TDZ: `api` определится ниже, замыкание исполнится позже).
const ratingApi = createRatingApi((path, init) => fetchWithTimeout(`${BASE}${path}`, { ...init, headers: authHeaders() }), (name, meta) => api.trackEvent(name, meta));

export const api = {
  // Общие с мини-аппом методы — из shared-фабрики (правило №3).
  ...buildSharedApi(transport),
  ...ratingApi,

  // Публичные вызовы БЕЗ auth (лид-магнит): контент тестов из quiz-registry и
  // анонимная аналитика — мини-тесты и клики лендинга (userId = null).
  getQuizzes: (form?: 'ty' | 'vy') =>
    get<{ quizzes: QuizDto[] }>(`/api/quizzes${form === 'vy' ? '?form=vy' : ''}`),
  getAllTherapyTasks:       () => get<{ clientId: number; clientName: string; tasks: UserTask[] }[]>('/api/therapy/tasks/all'),
  getConceptualization: (clientId: number) => get<ClientConceptualization | null>(`/api/therapy/conceptualization/${clientId}`),
  saveConceptualization: (clientId: number, body: Partial<Omit<ClientConceptualization, 'id' | 'therapistId' | 'clientId' | 'history' | 'updatedAt'>>) => postJson<ClientConceptualization>(`/api/therapy/conceptualization/${clientId}`, body),
  getTherapyClientHistory: (clientId: number) => get<{ date: string; index: number | null; ratings: Record<string, number> }[]>(`/api/therapy/client-history/${clientId}`),
  // Разборы фразы («Критик или забота?», теперь на обоих фронтендах — раньше
  // miniapp-only решение (PR #261), сайту тоже нужны write-методы, не только GET для «Тёплых слов»).
  // Случайная фраза Здорового Взрослого для карточки шаринга («Фраза для
  // себя», PhraseShareCard.tsx) — паритет с мини-аппом, правило №16.
  getHealthyPhrase:     () => get<{ text: string | null }>('/api/healthy-phrase'),
  getPhraseChecks:      () => get<PhraseCheckEntry[]>('/api/phrase-checks'),
  createPhraseCheck:    (body: { phrase: string; marks: PhraseMarkId[]; rewrite?: string; inWarmWords?: boolean }) => post('/api/phrase-checks', body),
  updatePhraseCheck:    (id: number, rewrite: string) => patchJson<{ id: number; rewrite: string | null }>(`/api/phrase-checks/${id}`, { rewrite }),
  deletePhraseCheck:    (id: number) => del(`/api/phrase-checks/${id}`),
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
  adminCheckPhrase:  (key: string, text: string) => adminReq<{ issues: PhraseIssue[] }>('POST', '/api/healthy-adult/admin/check', key, { text }),
  adminAuditPhrases: (key: string) => adminReq<AuditedPhrase[]>('GET', '/api/healthy-adult/admin/audit', key),
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
