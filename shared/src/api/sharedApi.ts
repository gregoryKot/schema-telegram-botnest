// Общие методы API (webapp, правило №3).
// До 2026-08 эндпоинты жили копией в двух api.ts, и фиксы доезжали до одного;
// теперь метод описан ОДИН раз здесь. Сайт добавляет только транспорт (webapp —
// JWT Bearer) и платформенные методы своего api.ts (booking/
// статьи/админка — сайт; exercises, saveRating с outbox-датой, conceptualization — локально).
import { THERAPY_RELATION_PATH } from '../therapy/freshRelation';
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
  UserId,
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
import type { FormerTherapistInfo } from '../therapy/formerTherapist';
import {
  THERAPY_INVITES_PATH,
  type TherapyInvite,
} from '../therapy/therapyInvites';
import type { CardClaim } from '../therapy/cardClaims';
import type {
  UserSchemaNote,
  UserModeNote,
  SaveSchemaNoteBody,
  SaveModeNoteBody,
} from '../notes/types';
import type { JourneyData } from '../journey/journeyMeta';
import type { TherapistNotesPage } from '../therapy/notesPage';
import type { PracticeIcsLinkBody } from '../practices/savePracticeIcs';

/** Транспорт фронтенда: auth-заголовки, BASE и обработка ошибок — внутри. */
export interface ApiTransport {
  get<T>(path: string): Promise<T>;
  post(path: string, body?: unknown): Promise<void>;
  postJson<T>(path: string, body: unknown): Promise<T>;
  del(path: string, body?: unknown): Promise<void>;
}

export const buildSharedApi = (t: ApiTransport) => ({
  // Пояс устройства (deviceTimeZone): пока человек не выбрал пояс сам, сервер
  // считает по нему «сегодня» — серию, недельную полосу, напоминания.
  init: (timezone?: string) => t.post('/api/init', { timezone }),

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
  // Только чтение: сервер отдаёт все UI-флаги (UserFlagsDto), здесь типизирован
  // срез, который читает вызывающая сторона. therapistMode — серверное
  // предпочтение терапевта «кабинет vs клиент», источник дефолтного роутинга.
  getUserFlags: () => t.get<{ therapistMode?: boolean }>('/api/user-flags'),
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
  deleteAllUserData: (code?: string) => t.del('/api/user', code && { code }), // code — 2FA
  getPendingPlans: () => t.get<PracticePlan[]>('/api/plan/pending'),
  getPlanHistory: (days = 30) =>
    t.get<PracticePlan[]>(`/api/plans/history?days=${days}`),
  createPlan: (
    needId: string,
    practiceText: string,
    reminderLocalHour?: number, // час по поясу человека, день считает сервер
  ) => t.post('/api/plan', { needId, practiceText, reminderLocalHour }),
  // Ссылка на .ics шага плана для хоста без data:-URL (Telegram, E6).
  practiceIcsLink: (body: PracticeIcsLinkBody) =>
    t.postJson<{ path: string }>('/api/plan/ics', body),
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
  /** Итог, вся история и прогресс теста разом — кнопка в настройках. */
  deleteYsqData: () => t.del('/api/ysq-data'),
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
    /** Запись из потока «Что случилось» (сайт). */
    fromCase?: boolean;
  }) => t.postJson<ModeDiaryEntry>('/api/diary/mode', data),
  deleteModeDiary: (id: number) => t.del(`/api/diary/mode/${id}`),
  getGratitudeDiary: () => t.get<GratitudeDiaryEntry[]>('/api/diary/gratitude'),
  // base — день до правки: сервер сливает с ним (src/bot/gratitude-merge.ts).
  createGratitudeDiary: (date: string, items: string[], base?: string[]) => {
    const body = { date, items, base };
    return t.postJson<GratitudeDiaryEntry>('/api/diary/gratitude', body);
  },
  deleteGratitudeDiary: (id: number) => t.del(`/api/diary/gratitude/${id}`),
  // Каждый вызов — новый код; alias — имя карточки из «Новый клиент».
  // url — сайт, tgUrl — Telegram (null — бот не настроен), аудит 2026-11 U3.
  createTherapyInvite: (alias?: string) =>
    t.postJson<{ code: string; url: string; tgUrl?: string | null }>(
      '/api/therapy/invite',
      alias ? { alias } : {},
    ),
  // Приглашение из карточки офлайн-клиента (clientId < 0): её данные переедут на
  // аккаунт, когда терапевт подтвердит сверку. Повтор отдаёт тот же живой код.
  createOfflineClientInvite: (clientId: UserId) =>
    t.postJson<{ code: string; url: string; tgUrl?: string | null }>(
      `/api/therapy/clients/${clientId}/invite`,
      {},
    ),
  getTherapyInvites: () => t.get<TherapyInvite[]>(THERAPY_INVITES_PATH),
  revokeTherapyInvite: (id: number) => t.del(`/api/therapy/invites/${id}`),
  // Сверка «тот же человек?» для кода из офлайн-карточки (S8, cardClaims.ts).
  getCardClaims: () => t.get<CardClaim[]>('/api/therapy/card-claims'),
  resolveCardClaim: (clientId: UserId, cardId: number, accept: boolean) =>
    t.post(`/api/therapy/card-claims/${clientId}`, { cardId, accept }),
  // Чей код — до согласия клиента (экран JoinConfirmSheet).
  previewTherapyInvite: (code: string) =>
    t.postJson<{
      therapistName: string | null;
      connection?: 'none' | 'same' | 'other';
    }>('/api/therapy/invite/preview', { code }),
  getTherapyRelation: () =>
    t.get<TherapyRelationInfo | null>(THERAPY_RELATION_PATH),
  // Терапевт отказался от роли — сообщение вместо «Мой терапевт».
  getFormerTherapist: () =>
    t.get<FormerTherapistInfo | null>('/api/therapy/former-therapist'),
  joinTherapy: (code: string) => t.post('/api/therapy/join', { code }),
  leaveTherapy: () => t.del('/api/therapy/relation'),
  getTherapyClients: () =>
    t.get<TherapyClientSummary[]>('/api/therapy/clients'),
  addVirtualClient: (name: string) =>
    t.postJson<TherapyClientSummary[]>('/api/therapy/clients/virtual', {
      name,
    }),
  removeClient: (id: UserId) => t.del(`/api/therapy/clients/${id}`),
  renameClient: (clientId: UserId, alias: string) =>
    t.post(`/api/therapy/rename-client/${clientId}`, { alias }),
  requestYsq: (clientId: UserId) =>
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
    clientId?: UserId;
  }) => t.postJson<UserTask>('/api/therapy/tasks', body),
  getTasks: () => t.get<UserTask[]>('/api/therapy/tasks'),
  getTaskHistory: () => t.get<UserTask[]>('/api/therapy/tasks/history'),
  completeTask: (id: number, done: boolean) =>
    t.post(`/api/therapy/tasks/${id}/complete`, { done }),
  /** Терапевт удаляет назначенное им задание текущему клиенту. */
  deleteTherapyTask: (id: number) => t.del(`/api/therapy/tasks/${id}`),
  getTherapyTasksForClient: (clientId: UserId) =>
    t.get<UserTask[]>(`/api/therapy/tasks/client/${clientId}`),
  getTherapistNotes: (clientId: UserId) =>
    t.get<TherapistNotesPage>(`/api/therapy/notes/${clientId}`),
  createTherapistNote: (clientId: UserId, date: string, text: string) =>
    t.postJson<TherapistNote>(`/api/therapy/notes/${clientId}`, { date, text }),
  deleteTherapistNote: (noteId: number) =>
    t.del(`/api/therapy/notes/${noteId}`),
  updateSessionInfo: (
    clientId: UserId,
    body: {
      therapyStartDate?: string | null;
      nextSession?: string | null;
      meetingDays?: number[];
    },
  ) => t.post(`/api/therapy/session-info/${clientId}`, body),
  getTherapyClientData: (clientId: UserId) =>
    t.get<ClientData>(`/api/therapy/client-data/${clientId}`),
  getSchemaNotes: () => t.get<UserSchemaNote[]>('/api/schema-notes'),
  saveSchemaNote: (body: SaveSchemaNoteBody) =>
    t.post('/api/schema-notes', body),
  getModeNotes: () => t.get<UserModeNote[]>('/api/mode-notes'),
  saveModeNote: (body: SaveModeNoteBody) => t.post('/api/mode-notes', body),
  // Разборы фразы (упражнение «Критик или забота?») — сайту
  // нужны для «Тёплых слов»: в коллекцию идут помеченные inWarmWords.
  getClientSchemaNotes: (clientId: UserId) =>
    t.get<UserSchemaNote[]>(`/api/therapy/client/${clientId}/schema-notes`),
  getClientModeNotes: (clientId: UserId) =>
    t.get<UserModeNote[]>(`/api/therapy/client/${clientId}/mode-notes`),
});
