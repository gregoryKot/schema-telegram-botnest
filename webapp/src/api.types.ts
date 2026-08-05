// Типы API webapp (зеркало бэкенда, ранее инлайном в api.ts).
// Вынесено из api.ts (правило №10).
//
// Типы, общие с мини-аппом, живут в shared/src/apiTypes (правило №3) — здесь
// только ре-экспорт. ConceptSnapshot ещё и импортируется: на него ссылается
// локальный ClientConceptualization (в webapp он с mode-map, потому локальный).
import type { ConceptSnapshot } from '../../shared/src/apiTypes';
export type {
  UserSettings,
  StreakData,
  Achievement,
  UserPractice,
  PartnerInfo,
  PairsData,
  PracticePlan,
  UserTask,
  TherapyRelationInfo,
  TherapistNote,
  ConceptSnapshot,
  YsqHistoryEntry,
  ClientData,
} from '../../shared/src/apiTypes';

// ─── Site-only types (booking, articles, mode-map) ───────────────────────────
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
/** Остаток пула канала: на сколько дней хватит ещё не звучавших фраз. */
export interface HealthyAdultPoolStatus { enabled: number; unused: number; daysLeft: number; }
export interface SiteContent { heroPhoto: string | null; marqueeTopicsA: MarqueeTopic[]; marqueeTopicsB: MarqueeTopic[]; }
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
export interface BeliefCheckEntry {
  id: number;
  belief: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  reframe: string | null;
  createdAt: string;
}
export interface LetterEntry {
  id: number;
  text: string;
  createdAt: string;
}
export interface FlashcardEntry {
  id: number;
  modeId: string;
  needId: string;
  reflection: string | null;
  action: string | null;
  createdAt: string;
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

