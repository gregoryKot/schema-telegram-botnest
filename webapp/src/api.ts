// Shared API client for the web app.
// Uses Authorization: Bearer <token> instead of x-telegram-init-data.
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

// ─── Shared types (mirrored from miniapp, same backend) ──────────────────────
export interface UserSettings {
  notifyEnabled: boolean;
  notifyLocalHour: number;
  notifyTimezone: string;
  notifyReminderEnabled: boolean;
  notifyFrequency?: number;          // 0=каждый день, 1=через день, 2=2×/нед, 3=раз/нед
  notifyQuietStart?: number;         // тихие часы: начало (локальный час)
  notifyQuietEnd?: number;           // тихие часы: конец; start===end → выключены
  notifyGamified?: boolean;          // opt-in игровой режим: серии + «ещё день до вехи»
  notifyPausedUntil?: string | null; // ISO-дата конца паузы; POST null = возобновить
  addressForm?: 'ty' | 'vy' | null;  // null = ещё не выбрано → показать выбор
  pairCardDismissed: boolean;
  mySchemaIds: string[];
  myModeIds: string[];
  therapistShareCards: boolean;
  therapistShareProfile: boolean;
}
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  todayDone: boolean;
  weekDots: boolean[];
}
export interface Achievement { id: string; earned: boolean; }
export interface BookingSlot { startsAt: string; endsAt: string; durationMin: number; }
export interface SessionOption { type: 'INTRO_15' | 'SESSION_50'; label: string; durationMin: number; price: number; note: string; }
export interface AvailabilityRule {
  id: number; dayOfWeek: number; startHour: number; startMinute: number;
  endHour: number; endMinute: number; sessionDuration: number; bufferMin: number;
  timezone: string; isActive: boolean;
}
export type NewAvailabilityRule = {
  dayOfWeek: number; startHour: number; endHour: number;
  startMinute?: number; endMinute?: number; sessionDuration?: number; bufferMin?: number; timezone?: string;
};
export interface AdminBooking {
  id: number; startsAt: string; durationMin: number; type: string; status: string;
  clientName: string; clientContact: string; message: string | null;
  cancelToken: string; meetingUrl: string | null;
}
/** Diagnostics snapshot from GET /api/booking/admin/status (no secrets). */
export interface AdminBookingStatus {
  siteUrl: string;
  appUrl: string;
  robokassa: boolean;
  robokassaTest: boolean;
  zoom: boolean;
  zoomVars: { accountId: boolean; clientId: boolean; clientSecret: boolean };
  meetingStaticUrl: boolean;
  appleCalendar: boolean;
  calendarBusyCount: number | null;
  calendarNames: string[];
  calendarBlocking: boolean;
  emailFallback: boolean;
}
export interface ArticleSummary {
  id: number; slug: string; title: string; description: string; date: string; readMin: number; heroImage?: string | null; diagramKey?: string | null;
}
export interface Article extends ArticleSummary { content: string; }
export type ArticleDto = { slug: string; title: string; description: string; content: string; date: string; readMin: number; heroImage?: string | null; diagramKey?: string | null; };
export interface MarqueeTopic { label: string; href: string; }
export interface HealthyAdultPhrase { id: number; text: string; enabled: boolean; sortOrder: number; }
export interface SiteContent { heroPhoto: string | null; marqueeTopicsA: MarqueeTopic[]; marqueeTopicsB: MarqueeTopic[]; }
export interface UserPractice { id: number; needId: string; text: string; }
export interface PartnerInfo {
  code: string;
  partnerIndex: number | null;
  partnerTodayDone: boolean;
  partnerName: string | null;
  partnerTelegramId: number | null;
  partnerWeekAvgs: (number | null)[];
}
export interface PairsData { partners: PartnerInfo[]; pendingCode: string | null; }
export interface PracticePlan {
  id: number;
  needId: string;
  practiceText: string;
  scheduledDate: string;
  reminderUtcHour: number | null;
  done: boolean | null;
}
export interface UserTask {
  id: number;
  userId: number;
  assignedBy: number | null;
  type: string;
  text: string;
  targetDays: number | null;
  needId: string | null;
  dueDate: string | null;
  done: boolean | null;
  completedAt: string | null;
  createdAt: string;
  doneToday?: boolean;
  progress?: number;
}
export interface TherapyRelationInfo {
  role: 'therapist' | 'client';
  status: string;
  partnerName: string | null;
  partnerId: number | null;
  code: string;
  nextSession: string | null;
}
export interface TherapyClientSummary {
  telegramId: number;
  name: string | null;
  clientAlias: string | null;
  streak: number;
  lastActiveDate: string | null;
  todayIndex: number | null;
  recentIndexHistory: (number | null)[];
  relationCreatedAt: string;
  therapyStartDate: string | null;
  nextSession: string | null;
  meetingDays: number[];
  schemaIds: string[];
}
export interface TherapistNote {
  id: number;
  therapistId: number;
  clientId: number;
  date: string;
  text: string;
  createdAt: string;
}
export interface ConceptSnapshot {
  savedAt: string;
  schemaIds: string[];
  modeIds: string[];
  earlyExperience: string | null;
  unmetNeeds: string | null;
  triggers: string | null;
  copingStyles: string | null;
  goals: string | null;
  currentProblems: string | null;
  modeTransitions?: string | null;
}
export interface TherapistCustomMode {
  id: number;
  therapistId: number;
  name: string;
  emoji: string;
  nodeType: string;
  createdAt: string;
}

export interface ModeMapNode {
  id: string;
  type: 'trigger' | 'child' | 'critic' | 'coping' | 'healthy' | 'custom' | 'behavior';
  position: { x: number; y: number };
  data: {
    modeId?: string;
    label: string;
    note?: string;
    unmetNeed?: string;
    customColor?: string;
    filled?: boolean;
    fillFull?: boolean;
    copingSubtype?: 'over' | 'avoid' | 'surr';
    display?: 'name' | 'note' | 'full';   // что показывать на фигуре
    healthyResponse?: string;             // что сказал бы Здоровый Взрослый
    strokeWidth?: 'thin' | 'normal' | 'bold';  // толщина контура фигуры
    fontSize?: 'sm' | 'md' | 'lg';        // размер текста в фигуре
    side?: 'A' | 'B';                      // чей режим на карте пары (Партнёр А / Б)
    schemaId?: string;                     // связанная схема (из списка схем клиента)
  };
  width?: number;
  height?: number;
}

export type EdgeType = 'activates' | 'protects' | 'suppresses' | 'leads_to';

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface ModeMapEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  data?: { edgeType?: EdgeType; bidirectional?: boolean; color?: string; lineStyle?: LineStyle; width?: 'thin' | 'normal' | 'bold' };
}

export type ModeMapKind = 'personality' | 'problem' | 'couple';

export interface ModeMapMeta {
  id: number;
  title: string;
  kind: ModeMapKind;
  createdAt: string;
  updatedAt: string;
}

export interface ModeMapFull extends ModeMapMeta {
  nodes: ModeMapNode[];
  edges: ModeMapEdge[];
}

export interface ClientConceptualization {
  id: number;
  therapistId: number;
  clientId: number;
  schemaIds: string[];
  modeIds: string[];
  earlyExperience: string | null;
  unmetNeeds: string | null;
  triggers: string | null;
  copingStyles: string | null;
  goals: string | null;
  currentProblems: string | null;
  modeTransitions: string | null;
  modeMapNodes: ModeMapNode[];
  modeMapEdges: ModeMapEdge[];
  history: ConceptSnapshot[];
  updatedAt: string;
}
export interface YsqHistoryEntry {
  id: number;
  completedAt: string;
  scores: { id: string; pct5plus: number }[];
}
export interface ClientData {
  name: string | null;
  mySchemaIds: string[];
  myModeIds: string[];
  ysqCompletedAt: string | null;
  ysqActiveSchemaIds: string[];
  ysqHistory: YsqHistoryEntry[];
}

// ─── API object (identical endpoints, different auth header) ──────────────────
export const api = {
  init:           (tzOffset?: number) => post('/api/init', { tzOffset }),
  getDisclaimer:  () => get<{ accepted: boolean }>('/api/disclaimer'),
  acceptDisclaimer: () => post('/api/disclaimer', {}),
  getYsqProgress: () => get<{ answers: number[]; page: number } | null>('/api/ysq-progress'),
  saveYsqProgress: (answers: number[], page: number) => post('/api/ysq-progress', { answers, page }),
  deleteYsqProgress: () => del('/api/ysq-progress'),
  needs:          () => get<any[]>('/api/needs'),
  ratings:        (date?: string) => get<Record<string, number>>(`/api/ratings${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  saveRating:     async (needId: string, value: number, date?: string): Promise<{ ok: boolean; allDone: boolean; streak?: any }> => {
    const res = await fetch(`${BASE}/api/rating`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ needId, value, date }), credentials: 'include' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  history:        (days = 7) => get<any[]>(`/api/history?days=${days}`),
  getSettings:    () => get<any>('/api/settings'),
  updateSettings: (body: any) => post('/api/settings', body),
  getAchievements: () => get<any[]>('/api/achievements'),
  getNote:         (date: string) => get<{ text: string | null; tags: string[] }>(`/api/note?date=${date}`),
  saveNote:        (date: string, text: string, tags?: string[]) => post('/api/note', { date, text, tags }),
  getStreak:      () => get<any>('/api/streak'),
  recordActivity: () => post('/api/activity', {}),
  getInsights:    () => get<any>('/api/insights'),
  getExport:      () => get<{ text: string }>('/api/export'),
  getPractices:   (needId: string) => get<any[]>(`/api/practices?needId=${needId}`),
  addPractice:    (needId: string, text: string) => post('/api/practices', { needId, text }),
  deletePractice: (id: number) => del(`/api/practices/${id}`),
  deleteAllUserData: () => del('/api/user'),
  getPendingPlans: () => get<any[]>('/api/plan/pending'),
  getPlanHistory:  (days = 30) => get<any[]>(`/api/plans/history?days=${days}`),
  createPlan:      (needId: string, practiceText: string, reminderUtcHour?: number) => post('/api/plan', { needId, practiceText, reminderUtcHour }),
  checkinPlan:     (id: number, done: boolean) => post(`/api/plan/${id}/checkin`, { done }),
  getPair:         () => get<any>('/api/pair'),
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
  getYsqHistory:   () => get<any[]>('/api/ysq-history'),
  getProfile:      () => get<any>('/api/profile'),
  updateName:      (name: string) => postJson<{ ok: boolean }>('/api/profile/name', { name }),
  getSchemaDiary:    () => get<any[]>('/api/diary/schema'),
  createSchemaDiary: (data: any) => postJson<any>('/api/diary/schema', data),
  deleteSchemaDiary: (id: number) => del(`/api/diary/schema/${id}`),
  getModeDiary:      () => get<any[]>('/api/diary/mode'),
  createModeDiary:   (data: any) => postJson<any>('/api/diary/mode', data),
  deleteModeDiary:   (id: number) => del(`/api/diary/mode/${id}`),
  getGratitudeDiary:    () => get<any[]>('/api/diary/gratitude'),
  createGratitudeDiary: (date: string, items: string[]) => postJson<any>('/api/diary/gratitude', { date, items }),
  deleteGratitudeDiary: (id: number) => del(`/api/diary/gratitude/${id}`),
  createTherapyInvite:  () => postJson<{ code: string; url: string }>('/api/therapy/invite', {}),
  getTherapyRelation:   () => get<any | null>('/api/therapy/relation'),
  joinTherapy:          (code: string) => post('/api/therapy/join', { code }),
  leaveTherapy:         () => del('/api/therapy/relation'),
  getTherapyClients:    () => get<any[]>('/api/therapy/clients'),
  addClientManually:    (clientTelegramId: number) => postJson<any[]>('/api/therapy/clients/add', { clientTelegramId }),
  addVirtualClient:     (name: string) => postJson<any[]>('/api/therapy/clients/virtual', { name }),
  removeClient:         (clientId: number) => del(`/api/therapy/clients/${clientId}`),
  renameClient:         (clientId: number, alias: string) => post(`/api/therapy/rename-client/${clientId}`, { alias }),
  requestYsq:           (clientId: number) => post(`/api/therapy/request-ysq/${clientId}`, {}),
  becomeTherapist:      (code: string) => postJson<{ ok: boolean }>('/api/therapy/become-therapist', { code }),
  getTherapistRequest:  () => get<{ id: number; status: string; rejectReason: string | null } | null>('/api/therapy/request'),
  submitTherapistRequest: (body: { fullName: string; qualification: string; contacts: string; message?: string }) =>
    postJson<{ ok: boolean }>('/api/therapy/request', body),
  setTherapistView:     (on: boolean) => postJson<{ ok: boolean }>('/api/therapy/therapist-view', { on }),
  resignTherapist:      () => del('/api/therapy/therapist-role'),
  createTask:           (body: any) => postJson<any>('/api/therapy/tasks', body),
  getTasks:             () => get<any[]>('/api/therapy/tasks'),
  getTaskHistory:       () => get<any[]>('/api/therapy/tasks/history'),
  completeTask:         (id: number, done: boolean) => post(`/api/therapy/tasks/${id}/complete`, { done }),
  getTherapyTasksForClient: (clientId: number) => get<any[]>(`/api/therapy/tasks/client/${clientId}`),
  getAllTherapyTasks:       () => get<{ clientId: number; clientName: string; tasks: UserTask[] }[]>('/api/therapy/tasks/all'),
  getTherapistNotes:    (clientId: number) => get<any[]>(`/api/therapy/notes/${clientId}`),
  createTherapistNote:  (clientId: number, date: string, text: string) => postJson<any>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote:  (noteId: number) => del(`/api/therapy/notes/${noteId}`),
  getConceptualization: (clientId: number) => get<ClientConceptualization | null>(`/api/therapy/conceptualization/${clientId}`),
  saveConceptualization: (clientId: number, body: Partial<Omit<ClientConceptualization, 'id' | 'therapistId' | 'clientId' | 'history' | 'updatedAt'>>) => postJson<ClientConceptualization>(`/api/therapy/conceptualization/${clientId}`, body),
  updateSessionInfo:    (clientId: number, body: any) => post(`/api/therapy/session-info/${clientId}`, body),
  getTherapyClientData: (clientId: number) => get<any>(`/api/therapy/client-data/${clientId}`),
  getTherapyClientHistory: (clientId: number) => get<{ date: string; index: number | null; ratings: Record<string, number> }[]>(`/api/therapy/client-history/${clientId}`),
  getSchemaNotes:       () => get<any[]>('/api/schema-notes'),
  saveSchemaNote:       (body: any) => post('/api/schema-notes', body),
  getModeNotes:         () => get<any[]>('/api/mode-notes'),
  saveModeNote:         (body: any) => post('/api/mode-notes', body),
  getBeliefChecks:      () => get<any[]>('/api/belief-checks'),
  createBeliefCheck:    (body: any) => post('/api/belief-checks', body),
  deleteBeliefCheck:    (id: number) => del(`/api/belief-checks/${id}`),
  getLetters:           () => get<any[]>('/api/letters'),
  createLetter:         (text: string) => post('/api/letters', { text }),
  deleteLetter:         (id: number) => del(`/api/letters/${id}`),
  getSafePlace:         () => get<any | null>('/api/safe-place'),
  saveSafePlace:        (description: string) => post('/api/safe-place', { description }),
  getFlashcards:        () => get<any[]>('/api/flashcards'),
  createFlashcard:      (body: any) => post('/api/flashcards', body),
  deleteFlashcard:      (id: number) => del(`/api/flashcards/${id}`),
  getClientSchemaNotes: (clientId: number) => get<any[]>(`/api/therapy/client/${clientId}/schema-notes`),
  getClientModeNotes:   (clientId: number) => get<any[]>(`/api/therapy/client/${clientId}/mode-notes`),
  getClientDiary:       (clientId: number) => get<{ type: 'schema' | 'mode' | 'gratitude'; date: string; schemaIds?: string[]; modeId?: string; excerpt: string }[]>(`/api/therapy/client/${clientId}/diary`),
  submitBooking:        (body: { name: string; contact: string; message?: string }) => postJson<{ ok: true }>('/api/booking', body),
  // Slot-based booking
  getBookingOptions:    () => get<SessionOption[]>('/api/booking/options'),
  getSlots:             (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return get<BookingSlot[]>(`/api/booking/slots${qs ? `?${qs}` : ''}`);
  },
  bookSlot:             (body: { startsAt: string; durationMin?: number; type?: 'INTRO_15' | 'SESSION_50'; clientName: string; clientContact: string; message?: string; returning?: boolean; acceptedOffer?: boolean; website?: string }) =>
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
