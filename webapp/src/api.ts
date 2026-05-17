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

// ─── Re-export all types from miniapp api (same backend) ─────────────────────
export type { UserSettings, StreakData, Achievement, UserPractice, PartnerInfo,
  PairsData, PracticePlan, UserTask, TherapyRelationInfo, TherapyClientSummary,
  TherapistNote, ConceptSnapshot, ClientConceptualization, YsqHistoryEntry, ClientData,
} from '../../schema-miniapp/src/api';

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
  createTask:           (body: any) => postJson<any>('/api/therapy/tasks', body),
  getTasks:             () => get<any[]>('/api/therapy/tasks'),
  getTaskHistory:       () => get<any[]>('/api/therapy/tasks/history'),
  completeTask:         (id: number, done: boolean) => post(`/api/therapy/tasks/${id}/complete`, { done }),
  getTherapyTasksForClient: (clientId: number) => get<any[]>(`/api/therapy/tasks/client/${clientId}`),
  getTherapistNotes:    (clientId: number) => get<any[]>(`/api/therapy/notes/${clientId}`),
  createTherapistNote:  (clientId: number, date: string, text: string) => postJson<any>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote:  (noteId: number) => del(`/api/therapy/notes/${noteId}`),
  getConceptualization: (clientId: number) => get<any | null>(`/api/therapy/conceptualization/${clientId}`),
  saveConceptualization:(clientId: number, body: any) => postJson<any>(`/api/therapy/conceptualization/${clientId}`, body),
  updateSessionInfo:    (clientId: number, body: any) => post(`/api/therapy/session-info/${clientId}`, body),
  getTherapyClientData: (clientId: number) => get<any>(`/api/therapy/client-data/${clientId}`),
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
};
