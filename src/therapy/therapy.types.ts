// Общие типы therapy-домена, используемые несколькими сервисами
// (therapy-relations.service.ts и другими читателями через контроллер).

export interface TherapyRelationInfo {
  role: 'therapist' | 'client';
  status: string;
  partnerName: string | null;
  partnerId: bigint | null;
  code: string;
  nextSession: string | null;
  meetingDays: number[]; // клиенту — дни встреч связи, терапевту — []
}

export interface TherapyClientSummary {
  telegramId: bigint;
  name: string | null;
  clientAlias: string | null;
  streak: number;
  lastActiveDate: string | null; // дни здесь — по календарю клиента (notifyTimezone)
  daysSinceActive: number | null; // 0 — отмечался сегодня у себя; терапевт этого дня не знает
  todayIndex: number | null;
  recentIndexHistory: (number | null)[]; // 14 days, index 0 = client's today
  relationCreatedAt: string;
  therapyStartDate: string | null;
  nextSession: string | null;
  meetingDays: number[];
  schemaIds: string[];
}
