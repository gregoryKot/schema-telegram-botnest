// Общие DTO/типы ответов API — единый источник для обоих фронтендов
// (webapp ↔ schema-miniapp, правило №3 CLAUDE.md); оба ре-экспортируют их из
// своих api-модулей. Здесь ТОЛЬКО типы, совпадающие в обоих фронтендах;
// расходящиеся остаются локальными (ClientConceptualization в webapp несёт
// modeMapNodes/modeMapEdges — mode-map есть только на сайте).
import type { UserId } from './userId';
import type { UiPrefsPatch } from './prefs/uiPrefsSync';
export type { UserId };

export interface UserSettings {
  notifyEnabled: boolean;
  notifyLocalHour: number;
  notifyTimezone: string;
  notifyReminderEnabled: boolean;
  notifyFrequency?: number; // 0=каждый день, 1=через день, 2=2×/нед, 3=раз/нед
  notifyQuietStart?: number; // тихие часы: начало (локальный час)
  notifyQuietEnd?: number; // тихие часы: конец; start===end → выключены
  notifyGamified?: boolean; // opt-in игровой режим: серии + «ещё день до вехи»
  notifyPausedUntil?: string | null; // ISO-дата конца паузы; POST null = возобновить
  addressForm?: 'ty' | 'vy' | null; // null = ещё не выбрано → показать выбор
  pairCardDismissed: boolean;
  mySchemaIds: string[];
  myModeIds: string[];
  therapistShareCards: boolean;
  therapistShareProfile: boolean;
  uiPrefs?: UiPrefsPatch | null; // настройки экранов; POST заменяет объект целиком
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
  partnerTelegramId: UserId | null;
  partnerWeekAvgs: (number | null)[];
}

export interface PairsData {
  partners: PartnerInfo[];
  pendingCode: string | null;
  /** Ссылка-приглашение ждущей пары (null — приглашения нет или бот не настроен). */
  pendingUrl?: string | null;
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
  userId: UserId;
  assignedBy: UserId | null;
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
  partnerId: UserId | null;
  code: string;
  nextSession: string | null;
  meetingDays?: number[]; // клиенту — для upcomingSession; нет у старого кэша
}

export interface TherapistNote {
  id: number;
  therapistId: UserId;
  clientId: UserId;
  date: string;
  text: string;
  createdAt: string;
}

/**
 * Связи одного режима в графической концептуализации (модель режимов):
 * какими схемами режим питается, какая потребность за ним не встретила
 * ответа, откуда он, как проявляется сейчас и что с ним делают в терапии.
 * Хранится массивом в ClientConceptualization.modeLinks (шифруется целиком,
 * как schemaIds/modeIds). Связь режима, убранного из modeIds, не стирается:
 * вернул режим — вернулись и его связи.
 */
export interface ConceptModeLink {
  modeId: string;
  /** Как режим называет сам клиент («Судья», «Маленькая Аня»). */
  alias: string;
  schemaIds: string[];
  /** NeedId из shared/src/needs/types.ts (NEED_ORDER). */
  needIds: string[];
  /** Откуда режим: ранний опыт, чей это голос. */
  origin: string;
  /** Текст на фигуре режима: что говорит критик, чего хочет ребёнок, что делает копинг, на что опирается здоровый режим. */
  manifest: string;
  /** Что делаем с режимом в терапии. */
  strategy: string;
}

/**
 * Схема в графической концептуализации: во что человек верит (убеждение
 * своими словами), как нарушалась потребность (детский опыт, из которого
 * схема выросла) и какие базовые потребности она блокирует (✗ на схеме
 * случая). Хранится массивом в ClientConceptualization.schemaLinks (шифруется
 * целиком, как modeLinks). Связь схемы, убранной из schemaIds, не стирается.
 */
export interface ConceptSchemaLink {
  schemaId: string;
  /** Убеждение схемы: «я верю, что…». */
  belief: string;
  /** Как нарушалась потребность: детский опыт, из которого выросла схема. */
  origin: string;
  /** Какие потребности схема блокирует. NeedId из shared/src/needs/types.ts. */
  needIds: string[];
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
  /** Снапшоты до графической концептуализации этого поля не несут. */
  modeLinks?: ConceptModeLink[];
  schemaLinks?: ConceptSchemaLink[];
}

export interface YsqHistoryEntry {
  id: number;
  completedAt: string;
  scores: { id: string; pct5plus: number; avg?: number; active?: boolean }[];
}

export interface ClientData {
  name: string | null;
  mySchemaIds: string[];
  myModeIds: string[];
  ysqCompletedAt: string | null;
  ysqActiveSchemaIds: string[];
  ysqHistory: YsqHistoryEntry[];
}

export interface Insights {
  weeklyStats: Array<{
    needId: string;
    avg: number | null;
    trend: '↑' | '↓' | '→';
  }>;
  bestDayOfWeek: string | null;
  worstDayOfWeek: string | null;
  totalDays: number;
}
