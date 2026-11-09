import type { UserId } from './userId';
export interface Need {
  id: string;
  emoji: string;
  title: string;
  chartLabel: string;
}

export interface DayHistory {
  date: string;
  ratings: Record<string, number>;
}

// Цвет потребности — только shared/src/needs/needColors.ts; здесь реэкспорт
// для импортов `from '../types'`. Тут жила вторая, старая палитра COLORS:
// колесо истории, карточки шаринга и весь мини-апп красили ею привязанность
// в розовый, остальные экраны — тоном hue (QA 2026-11, B-З7).
export { NEED_COLORS } from './needs/needColors';

// ─── Diary types ──────────────────────────────────────────────────────────────

export type DiaryType = 'schema' | 'mode' | 'gratitude';

export interface EmotionEntry {
  id: string;
  intensity: number;
}

export interface SchemaDiaryEntry {
  id: number;
  createdAt: string;
  trigger: string;
  emotions: EmotionEntry[];
  thoughts?: string | null;
  bodyFeelings?: string | null;
  actualBehavior?: string | null;
  schemaIds: string[];
  schemaOrigin?: string | null;
  healthyView?: string | null;
  realProblems?: string | null;
  excessiveReactions?: string | null;
  healthyBehavior?: string | null;
}

export interface ModeDiaryEntry {
  id: number;
  createdAt: string;
  modeId: string;
  situation: string;
  thoughts?: string | null;
  feelings?: string | null;
  bodyFeelings?: string | null;
  actions?: string | null;
  actualNeed?: string | null;
  childhoodMemories?: string | null;
  healthyResponse?: string | null;
  /** Запись из потока «Что случилось»; старые записи — без поля или false. */
  fromCase?: boolean;
}

export interface GratitudeDiaryEntry {
  id: number;
  date: string;
  items: string[];
  createdAt: string;
}

export interface UserProfile {
  name: string | null;
  role: 'CLIENT' | 'THERAPIST';
  ysq: {
    completedAt: string | null;
    activeSchemaIds: string[];
  };
  notifications: {
    enabled: boolean;
    reminderEnabled: boolean;
    timezone: string;
    localHour: number;
  };
  streak: number;
  lastActivity: {
    needsTracker: string | null;
    schemaDiary: string | null;
    modeDiary: string | null;
    gratitudeDiary: string | null;
  };
  mySchemaIds: string[];
  myModeIds: string[];
  /** Списки, которые на сервере не расшифровались: в полях выше для них `[]`,
   *  но это не «пусто» (src/bot/profile.service.ts). Нет у старого сервера. */
  unreadableLists?: ('mySchemaIds' | 'myModeIds')[];
}

// Сводка клиента в кабинете терапевта — единственная фронтовая копия (правило
// №3). Источник правды — src/therapy/therapy.types.ts на бэке (бэк не может
// импортировать shared из-за rootDir=src: пара бэк↔shared, меняй оба).
export interface TherapyClientSummary {
  telegramId: UserId;
  urlCode?: string; // постоянный код адреса карточки /cabinet/<код> (utils/clientRef); нет у старого кэша и старого сервера
  name: string | null;
  clientAlias: string | null;
  streak: number;
  lastActiveDate: string | null; // день по календарю клиента, не терапевта
  daysSinceActive?: number | null; // до сегодня клиента, считает сервер (isActiveToday); нет у старого кэша
  todayIndex: number | null;
  recentIndexHistory: (number | null)[]; // 14 дней клиента, index 0 = его сегодня
  relationCreatedAt: string;
  therapyStartDate: string | null;
  nextSession: string | null;
  meetingDays: number[];
  schemaIds: string[];
}
