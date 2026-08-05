// Общие DTO/типы ответов API — единый источник для обоих фронтендов
// (webapp ↔ schema-miniapp, правило №3 CLAUDE.md). Оба фронта ре-экспортируют
// их из своих api-модулей, поэтому импорты потребителей не меняются.
//
// Здесь ТОЛЬКО типы, совпадающие в обоих фронтендах. Расходящиеся намеренно
// остаются локальными: напр. ClientConceptualization в webapp несёт
// modeMapNodes/modeMapEdges (фича mode-map есть только на сайте).

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

export interface YsqHistoryEntry {
  id: number;
  completedAt: string;
  scores: { id: string; pct5plus: number; avg?: number }[];
}

export interface ClientData {
  name: string | null;
  mySchemaIds: string[];
  myModeIds: string[];
  ysqCompletedAt: string | null;
  ysqActiveSchemaIds: string[];
  ysqHistory: YsqHistoryEntry[];
}
