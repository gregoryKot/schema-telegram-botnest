// Общие типы therapy-домена, используемые несколькими сервисами
// (therapy-relations.service.ts и другими читателями через контроллер).

export interface TherapyRelationInfo {
  role: 'therapist' | 'client';
  status: string;
  partnerName: string | null;
  partnerId: bigint | null;
  code: string;
  nextSession: string | null;
}

export interface TherapyClientSummary {
  telegramId: bigint;
  name: string | null;
  clientAlias: string | null;
  streak: number;
  lastActiveDate: string | null;
  todayIndex: number | null;
  recentIndexHistory: (number | null)[]; // 14 values, index 0 = today
  relationCreatedAt: string;
  therapyStartDate: string | null;
  nextSession: string | null;
  meetingDays: number[];
  schemaIds: string[];
}
