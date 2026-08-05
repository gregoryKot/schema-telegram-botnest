// Общие методы API обоих фронтендов (webapp ↔ schema-miniapp, правило №3).
// До 2026-08 один и тот же список эндпоинтов жил копией в двух api.ts —
// новый метод дописывали в оба, и фиксы доезжали до одного (класс дрейфа №3).
// Теперь метод описывается ОДИН раз здесь; фронт отличается только транспортом
// (webapp — JWT Bearer, мини-апп — initData) и платформенными методами,
// которые остаются в его api.ts (booking/статьи/админка — сайт; exercises,
// saveRating с outbox-датой, conceptualization со своим типом — оба локально).
import type {
  Need,
  UserProfile,
  DayHistory,
  EmotionEntry,
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
  TherapyClientSummary,
} from '../types';
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
  YsqHistoryEntry,
  ClientData,
  Insights,
} from '../apiTypes';
import type {
  UserSchemaNote,
  UserModeNote,
  SaveSchemaNoteBody,
  SaveModeNoteBody,
} from '../notes/types';
import type { JourneyData } from '../journey/journeyMeta';

/** Транспорт фронтенда: auth-заголовки, BASE и обработка ошибок — внутри. */
export interface ApiTransport {
  get<T>(path: string): Promise<T>;
  post(path: string, body?: unknown): Promise<void>;
  postJson<T>(path: string, body: unknown): Promise<T>;
  del(path: string, body?: unknown): Promise<void>;
}

export const buildSharedApi = (t: ApiTransport) => ({
  init: (tzOffset?: number) => t.post('/api/init', { tzOffset }),

  // Продуктовая аналитика (правило №8). Fire-and-forget: аналитика НИКОГДА не
  // влияет на UX — ошибки/сеть глотаем, промис не пробрасываем.
  trackEvent: (name: string, meta?: Record<string, unknown>): void => {
    void t.post('/api/event', { name, meta }).catch(() => undefined);
  },

  // Публичные вызовы БЕЗ auth (лид-магнит): контент тестов из quiz-registry и
  // анонимная аналитика — мини-тесты и клики лендинга (userId = null).
  trackPublicEvent: (name: string, meta?: Record<string, unknown>): void => {
    void t.post('/api/public-event', { name, meta }).catch(() => undefined);
  },
  getDisclaimer: () => t.get<{ accepted: boolean }>('/api/disclaimer'),
  acceptDisclaimer: () => t.post('/api/disclaimer', {}),
  getYsqProgress: () =>
    t.get<{ answers: number[]; page: number } | null>('/api/ysq-progress'),
  saveYsqProgress: (answers: number[], page: number) =>
    t.post('/api/ysq-progress', { answers, page }),
  deleteYsqProgress: () => t.del('/api/ysq-progress'),
  needs: () => t.get<Need[]>('/api/needs'),
  ratings: (date?: string) =>
    t.get<Record<string, number>>(
      `/api/ratings${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    ),
  history: (days = 7) => t.get<DayHistory[]>(`/api/history?days=${days}`),
  getSettings: () => t.get<UserSettings>('/api/settings'),
  updateSettings: (body: Partial<UserSettings>) =>
    t.post('/api/settings', body),
  getAchievements: () => t.get<Achievement[]>('/api/achievements'),
  getNote: (date: string) =>
    t.get<{ text: string | null; tags: string[] }>(`/api/note?date=${date}`),
  saveNote: (date: string, text: string, tags?: string[]) =>
    t.post('/api/note', { date, text, tags }),
  getStreak: () => t.get<StreakData>('/api/streak'),
  recordActivity: () => t.post('/api/activity', {}),
  getInsights: () => t.get<Insights>('/api/insights'),
  getExport: () => t.get<{ text: string }>('/api/export'),
  getJourney: () => t.get<JourneyData>('/api/journey'),
  getPractices: (needId: string) =>
    t.get<UserPractice[]>(`/api/practices?needId=${needId}`),
  addPractice: (needId: string, text: string) =>
    t.post('/api/practices', { needId, text }),
  deletePractice: (id: number) => t.del(`/api/practices/${id}`),
  deleteAllUserData: () => t.del('/api/user'),
  getPendingPlans: () => t.get<PracticePlan[]>('/api/plan/pending'),
  getPlanHistory: (days = 30) =>
    t.get<PracticePlan[]>(`/api/plans/history?days=${days}`),
  createPlan: (
    needId: string,
    practiceText: string,
    reminderUtcHour?: number,
  ) => t.post('/api/plan', { needId, practiceText, reminderUtcHour }),
  checkinPlan: (id: number, done: boolean) =>
    t.post(`/api/plan/${id}/checkin`, { done }),
  getPair: () => t.get<PairsData>('/api/pair'),
  createPairInvite: () =>
    t.postJson<{ code: string; url: string }>('/api/pair/invite', {}),
  joinPair: (code: string) => t.post('/api/pair/join', { code }),
  leavePair: (code: string) => t.del('/api/pair', { code }),
  getChildhoodRatings: () =>
    t.get<Record<string, number>>('/api/childhood-ratings'),
  saveChildhoodRatings: (ratings: Record<string, number>) =>
    t.post('/api/childhood-ratings', ratings),
  getYsqResult: () =>
    t.get<{ answers: number[]; completedAt: string } | null>('/api/ysq-result'),
  saveYsqResult: (answers: number[]) => t.post('/api/ysq-result', { answers }),
  deleteYsqResult: () => t.del('/api/ysq-result'),
  getYsqHistory: () => t.get<YsqHistoryEntry[]>('/api/ysq-history'),
  getProfile: () => t.get<UserProfile>('/api/profile'),
  updateName: (name: string) =>
    t.postJson<{ ok: boolean }>('/api/profile/name', { name }),
  getSchemaDiary: () => t.get<SchemaDiaryEntry[]>('/api/diary/schema'),
  createSchemaDiary: (data: {
    trigger: string;
    emotions: EmotionEntry[];
    thoughts?: string;
    bodyFeelings?: string;
    actualBehavior?: string;
    schemaIds: string[];
    schemaOrigin?: string;
    healthyView?: string;
    realProblems?: string;
    excessiveReactions?: string;
    healthyBehavior?: string;
  }) => t.postJson<SchemaDiaryEntry>('/api/diary/schema', data),
  deleteSchemaDiary: (id: number) => t.del(`/api/diary/schema/${id}`),
  getModeDiary: () => t.get<ModeDiaryEntry[]>('/api/diary/mode'),
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
  }) => t.postJson<ModeDiaryEntry>('/api/diary/mode', data),
  deleteModeDiary: (id: number) => t.del(`/api/diary/mode/${id}`),
  getGratitudeDiary: () => t.get<GratitudeDiaryEntry[]>('/api/diary/gratitude'),
  createGratitudeDiary: (date: string, items: string[]) =>
    t.postJson<GratitudeDiaryEntry>('/api/diary/gratitude', { date, items }),
  deleteGratitudeDiary: (id: number) => t.del(`/api/diary/gratitude/${id}`),
  createTherapyInvite: () =>
    t.postJson<{ code: string; url: string }>('/api/therapy/invite', {}),
  getTherapyRelation: () =>
    t.get<TherapyRelationInfo | null>('/api/therapy/relation'),
  joinTherapy: (code: string) => t.post('/api/therapy/join', { code }),
  leaveTherapy: () => t.del('/api/therapy/relation'),
  getTherapyClients: () =>
    t.get<TherapyClientSummary[]>('/api/therapy/clients'),
  addClientManually: (clientTelegramId: number) =>
    t.postJson<TherapyClientSummary[]>('/api/therapy/clients/add', {
      clientTelegramId,
    }),
  addVirtualClient: (name: string) =>
    t.postJson<TherapyClientSummary[]>('/api/therapy/clients/virtual', {
      name,
    }),
  removeClient: (clientId: number) => t.del(`/api/therapy/clients/${clientId}`),
  renameClient: (clientId: number, alias: string) =>
    t.post(`/api/therapy/rename-client/${clientId}`, { alias }),
  requestYsq: (clientId: number) =>
    t.post(`/api/therapy/request-ysq/${clientId}`, {}),
  becomeTherapist: (code: string) =>
    t.postJson<{ ok: boolean }>('/api/therapy/become-therapist', { code }),
  getTherapistRequest: () =>
    t.get<{ id: number; status: string; rejectReason: string | null } | null>(
      '/api/therapy/request',
    ),
  submitTherapistRequest: (body: {
    fullName: string;
    qualification: string;
    contacts: string;
    message?: string;
  }) => t.postJson<{ ok: boolean }>('/api/therapy/request', body),
  setTherapistView: (on: boolean) =>
    t.postJson<{ ok: boolean }>('/api/therapy/therapist-view', { on }),
  resignTherapist: () => t.del('/api/therapy/therapist-role'),
  createTask: (body: {
    type: string;
    text: string;
    targetDays?: number;
    needId?: string;
    dueDate?: string;
    clientId?: number;
  }) => t.postJson<UserTask>('/api/therapy/tasks', body),
  getTasks: () => t.get<UserTask[]>('/api/therapy/tasks'),
  getTaskHistory: () => t.get<UserTask[]>('/api/therapy/tasks/history'),
  completeTask: (id: number, done: boolean) =>
    t.post(`/api/therapy/tasks/${id}/complete`, { done }),
  getTherapyTasksForClient: (clientId: number) =>
    t.get<UserTask[]>(`/api/therapy/tasks/client/${clientId}`),
  getTherapistNotes: (clientId: number) =>
    t.get<TherapistNote[]>(`/api/therapy/notes/${clientId}`),
  createTherapistNote: (clientId: number, date: string, text: string) =>
    t.postJson<TherapistNote>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote: (noteId: number) =>
    t.del(`/api/therapy/notes/${noteId}`),
  updateSessionInfo: (
    clientId: number,
    body: {
      therapyStartDate?: string | null;
      nextSession?: string | null;
      meetingDays?: number[];
    },
  ) => t.post(`/api/therapy/session-info/${clientId}`, body),
  getTherapyClientData: (clientId: number) =>
    t.get<ClientData>(`/api/therapy/client-data/${clientId}`),
  getSchemaNotes: () => t.get<UserSchemaNote[]>('/api/schema-notes'),
  saveSchemaNote: (body: SaveSchemaNoteBody) =>
    t.post('/api/schema-notes', body),
  getModeNotes: () => t.get<UserModeNote[]>('/api/mode-notes'),
  saveModeNote: (body: SaveModeNoteBody) => t.post('/api/mode-notes', body),
  // Разборы фразы (упражнение «Критик или забота?» живёт в мини-аппе) — сайту
  // нужны для «Тёплых слов»: в коллекцию идут помеченные inWarmWords.
  getClientSchemaNotes: (clientId: number) =>
    t.get<UserSchemaNote[]>(`/api/therapy/client/${clientId}/schema-notes`),
  getClientModeNotes: (clientId: number) =>
    t.get<UserModeNote[]>(`/api/therapy/client/${clientId}/mode-notes`),
});
