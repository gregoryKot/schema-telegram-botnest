const rawBase = (import.meta.env.VITE_API_URL as string) ?? '';
const BASE = rawBase && !rawBase.startsWith('http') ? `https://${rawBase}` : rawBase;

function authHeaders(): Record<string, string> {
  return {
    'x-telegram-init-data': window.Telegram?.WebApp?.initData ?? '',
    'Content-Type': 'application/json',
  };
}

async function fetchWithTimeout(input: string, init: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
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
    try { const j = await res.json(); if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message); } catch {}
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
    try { const j = await res.json(); if (j?.message) msg = typeof j.message === 'string' ? j.message : JSON.stringify(j.message); } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

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

export interface Achievement {
  id: string;
  earned: boolean;
}

export interface UserPractice {
  id: number;
  needId: string;
  text: string;
}

export interface PartnerInfo {
  code: string;
  partnerIndex: number | null;
  partnerTodayDone: boolean;
  partnerName: string | null;
  partnerTelegramId: number | null;
  partnerWeekAvgs: (number | null)[];
}

export interface PairsData {
  partners: PartnerInfo[];
  pendingCode: string | null;
}

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
  relationCreatedAt: string;
  therapyStartDate: string | null;
  nextSession: string | null;
  meetingDays: number[];
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

export const api = {
  init:           (tzOffset?: number) => post('/api/init', { tzOffset }),
  getDisclaimer:  () => get<{ accepted: boolean }>('/api/disclaimer'),
  acceptDisclaimer: () => post('/api/disclaimer', {}),
  getYsqProgress: () => get<{ answers: number[]; page: number } | null>('/api/ysq-progress'),
  saveYsqProgress: (answers: number[], page: number) => post('/api/ysq-progress', { answers, page }),
  deleteYsqProgress: async () => {
    const res = await fetch(`${BASE}/api/ysq-progress`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  needs:          () => get<import('./types').Need[]>('/api/needs'),
  ratings:        (date?: string) => get<Record<string, number>>(`/api/ratings${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  saveRating:     async (needId: string, value: number, date?: string): Promise<{ ok: boolean; allDone: boolean; streak?: StreakData }> => {
    const res = await fetch(`${BASE}/api/rating`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ needId, value, date }) });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  history:        (days = 7) => get<import('./types').DayHistory[]>(`/api/history?days=${days}`),
  getSettings:    () => get<UserSettings>('/api/settings'),
  updateSettings: (body: Partial<UserSettings>) => post('/api/settings', body),
  getAchievements: () => get<Achievement[]>('/api/achievements'),
  getNote:         (date: string) => get<{ text: string | null; tags: string[] }>(`/api/note?date=${date}`),
  saveNote:        (date: string, text: string, tags?: string[]) => post('/api/note', { date, text, tags }),
  getStreak:      () => get<StreakData>('/api/streak'),
  recordActivity: () => post('/api/activity', {}),
  getInsights:    () => get<{
    weeklyStats: Array<{ needId: string; avg: number | null; trend: '↑' | '↓' | '→' }>;
    bestDayOfWeek: string | null;
    worstDayOfWeek: string | null;
    totalDays: number;
  }>('/api/insights'),
  getExport: () => get<{ text: string }>('/api/export'),
  getPractices:  (needId: string) => get<UserPractice[]>(`/api/practices?needId=${needId}`),
  addPractice:   (needId: string, text: string) => post('/api/practices', { needId, text }),
  deletePractice:(id: number) => fetch(`${BASE}/api/practices/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); }),
  deleteAllUserData: () => fetch(`${BASE}/api/user`, { method: 'DELETE', headers: authHeaders() }).then(r => { if (!r.ok) throw new Error('Failed'); }),
  getPendingPlans:() => get<PracticePlan[]>('/api/plan/pending'),
  getPlanHistory: (days = 30) => get<PracticePlan[]>(`/api/plans/history?days=${days}`),
  createPlan:    (needId: string, practiceText: string, reminderUtcHour?: number) =>
    post('/api/plan', { needId, practiceText, reminderUtcHour }),
  checkinPlan:   (id: number, done: boolean) => post(`/api/plan/${id}/checkin`, { done }),
  getPair: () => get<PairsData>('/api/pair'),
  createPairInvite: async () => {
    const res = await fetch(`${BASE}/api/pair/invite`, { method: 'POST', headers: authHeaders(), body: '{}' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<{ code: string; url: string }>;
  },
  joinPair: (code: string) => post('/api/pair/join', { code }),
  leavePair: async (code: string) => {
    const res = await fetch(`${BASE}/api/pair`, { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ code }) });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  getChildhoodRatings: () => get<Record<string, number>>('/api/childhood-ratings'),
  saveChildhoodRatings: (ratings: Record<string, number>) => post('/api/childhood-ratings', ratings),
  getYsqResult: () => get<{ answers: number[]; completedAt: string } | null>('/api/ysq-result'),
  saveYsqResult: (answers: number[]) => post('/api/ysq-result', { answers }),
  deleteYsqResult: async () => {
    const res = await fetch(`${BASE}/api/ysq-result`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
  },
  getYsqHistory: () => get<YsqHistoryEntry[]>('/api/ysq-history'),

  // ─── Profile ────────────────────────────────────────────────────────────────
  getProfile: () => get<import('./types').UserProfile>('/api/profile'),
  updateName: (name: string) => postJson<{ ok: boolean }>('/api/profile/name', { name }),

  // ─── Diary ──────────────────────────────────────────────────────────────────
  getSchemaDiary:    () => get<import('./types').SchemaDiaryEntry[]>('/api/diary/schema'),
  createSchemaDiary: (data: {
    trigger: string; emotions: import('./types').EmotionEntry[];
    thoughts?: string; bodyFeelings?: string; actualBehavior?: string;
    schemaIds: string[]; schemaOrigin?: string; healthyView?: string;
    realProblems?: string; excessiveReactions?: string; healthyBehavior?: string;
  }) => postJson<import('./types').SchemaDiaryEntry>('/api/diary/schema', data),
  deleteSchemaDiary: (id: number) => del(`/api/diary/schema/${id}`),

  getModeDiary: () => get<import('./types').ModeDiaryEntry[]>('/api/diary/mode'),
  createModeDiary: (data: {
    modeId: string; situation: string; thoughts?: string; feelings?: string;
    bodyFeelings?: string; actions?: string; actualNeed?: string; childhoodMemories?: string;
  }) => postJson<import('./types').ModeDiaryEntry>('/api/diary/mode', data),
  deleteModeDiary: (id: number) => del(`/api/diary/mode/${id}`),

  getGratitudeDiary:    () => get<import('./types').GratitudeDiaryEntry[]>('/api/diary/gratitude'),
  createGratitudeDiary: (date: string, items: string[]) =>
    postJson<import('./types').GratitudeDiaryEntry>('/api/diary/gratitude', { date, items }),
  deleteGratitudeDiary: (id: number) => del(`/api/diary/gratitude/${id}`),

  // ─── Therapy / Tasks ─────────────────────────────────────────────────────────
  createTherapyInvite: () => postJson<{ code: string; url: string }>('/api/therapy/invite', {}),
  getTherapyRelation: () => get<TherapyRelationInfo | null>('/api/therapy/relation'),
  joinTherapy: (code: string) => post('/api/therapy/join', { code }),
  leaveTherapy: () => del('/api/therapy/relation'),
  getTherapyClients: () => get<TherapyClientSummary[]>('/api/therapy/clients'),
  addClientManually: (clientTelegramId: number) => postJson<TherapyClientSummary[]>('/api/therapy/clients/add', { clientTelegramId }),
  addVirtualClient: (name: string) => postJson<TherapyClientSummary[]>('/api/therapy/clients/virtual', { name }),
  removeClient: (clientId: number) => del(`/api/therapy/clients/${clientId}`),
  renameClient: (clientId: number, alias: string) => post(`/api/therapy/rename-client/${clientId}`, { alias }),
  requestYsq: (clientId: number) => post(`/api/therapy/request-ysq/${clientId}`, {}),
  becomeTherapist: (code: string) => postJson<{ ok: boolean }>('/api/therapy/become-therapist', { code }),
  getTherapistRequest: () => get<{ id: number; status: string; rejectReason: string | null } | null>('/api/therapy/request'),
  submitTherapistRequest: (body: { fullName: string; qualification: string; contacts: string; message?: string }) =>
    postJson<{ ok: boolean }>('/api/therapy/request', body),
  createTask: (body: { type: string; text: string; targetDays?: number; needId?: string; dueDate?: string; clientId?: number }) =>
    postJson<UserTask>('/api/therapy/tasks', body),
  getTasks: () => get<UserTask[]>('/api/therapy/tasks'),
  getTaskHistory: () => get<UserTask[]>('/api/therapy/tasks/history'),
  completeTask: (id: number, done: boolean) => post(`/api/therapy/tasks/${id}/complete`, { done }),
  getTherapyTasksForClient: (clientId: number) => get<UserTask[]>(`/api/therapy/tasks/client/${clientId}`),

  // ─── Therapist Notes ─────────────────────────────────────────────────────────
  getTherapistNotes: (clientId: number) => get<TherapistNote[]>(`/api/therapy/notes/${clientId}`),
  createTherapistNote: (clientId: number, date: string, text: string) =>
    postJson<TherapistNote>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote: (noteId: number) => del(`/api/therapy/notes/${noteId}`),

  // ─── Case Conceptualization ──────────────────────────────────────────────────
  getConceptualization: (clientId: number) => get<ClientConceptualization | null>(`/api/therapy/conceptualization/${clientId}`),
  saveConceptualization: (clientId: number, body: {
    schemaIds?: string[]; modeIds?: string[];
    earlyExperience?: string; unmetNeeds?: string;
    triggers?: string; copingStyles?: string; goals?: string; currentProblems?: string;
    modeTransitions?: string;
  }) => postJson<ClientConceptualization>(`/api/therapy/conceptualization/${clientId}`, body),
  updateSessionInfo: (clientId: number, body: { therapyStartDate?: string | null; nextSession?: string | null; meetingDays?: number[] }) =>
    post(`/api/therapy/session-info/${clientId}`, body),

  // ─── Client YSQ / profile data ───────────────────────────────────────────────
  getTherapyClientData: (clientId: number) => get<ClientData>(`/api/therapy/client-data/${clientId}`),

  // ─── Schema & Mode Notes ─────────────────────────────────────────────────────
  getSchemaNotes: () => get<Array<{ schemaId: string; triggers: string; feelings: string; thoughts: string; origins: string; reality: string; healthyView: string; behavior: string }>>('/api/schema-notes'),
  saveSchemaNote: (body: { schemaId: string; triggers?: string; feelings?: string; thoughts?: string; origins?: string; reality?: string; healthyView?: string; behavior?: string }) =>
    post('/api/schema-notes', body),
  getModeNotes: () => get<Array<{ modeId: string; triggers: string; feelings: string; thoughts: string; needs: string; behavior: string }>>('/api/mode-notes'),
  saveModeNote: (body: { modeId: string; triggers?: string; feelings?: string; thoughts?: string; needs?: string; behavior?: string }) =>
    post('/api/mode-notes', body),

  // ─── Exercises ───────────────────────────────────────────────────────────────
  getBeliefChecks: () => get<Array<{ id: number; belief: string; evidenceFor: string[]; evidenceAgainst: string[]; reframe: string | null; createdAt: string }>>('/api/belief-checks'),
  createBeliefCheck: (body: { belief: string; evidenceFor: string[]; evidenceAgainst: string[]; reframe?: string }) => post('/api/belief-checks', body),
  deleteBeliefCheck: (id: number) => del(`/api/belief-checks/${id}`),

  getLetters: () => get<Array<{ id: number; text: string; createdAt: string }>>('/api/letters'),
  createLetter: (text: string) => post('/api/letters', { text }),
  deleteLetter: (id: number) => del(`/api/letters/${id}`),

  getSafePlace: () => get<{ description: string; updatedAt: string } | null>('/api/safe-place'),
  saveSafePlace: (description: string) => post('/api/safe-place', { description }),

  getFlashcards: () => get<Array<{ id: number; modeId: string; needId: string; reflection: string | null; action: string | null; createdAt: string }>>('/api/flashcards'),
  createFlashcard: (body: { modeId: string; needId: string; reflection?: string; action?: string }) => post('/api/flashcards', body),
  deleteFlashcard: (id: number) => del(`/api/flashcards/${id}`),

  // ─── Therapist client notes ──────────────────────────────────────────────────
  getClientSchemaNotes: (clientId: number) => get<Array<{ schemaId: string; triggers: string; feelings: string; thoughts: string; origins: string; reality: string; healthyView: string; behavior: string }>>(`/api/therapy/client/${clientId}/schema-notes`),
  getClientModeNotes: (clientId: number) => get<Array<{ modeId: string; triggers: string; feelings: string; thoughts: string; needs: string; behavior: string }>>(`/api/therapy/client/${clientId}/mode-notes`),
};
