import type { Prisma } from '@prisma/client';
import { encryptName } from './client-name';

export interface SessionInfoBody {
  therapyStartDate?: string | null;
  nextSession?: string | null;
  meetingDays?: number[];
  /** Заметка «О клиенте»: null или пустая — очистить. */
  memo?: string | null;
}

/** Поля связи, которые терапевт правит в карточке; не пришедшее — не трогается. */
export function sessionInfoData(
  body: SessionInfoBody,
): Prisma.TherapyRelationUpdateManyMutationInput {
  const data: Prisma.TherapyRelationUpdateManyMutationInput = {};
  if (body.therapyStartDate !== undefined)
    data.therapyStartDate = body.therapyStartDate;
  if (body.nextSession !== undefined) data.nextSession = body.nextSession;
  if (body.meetingDays !== undefined) data.meetingDays = body.meetingDays;
  if (body.memo !== undefined) data.therapistMemo = encryptName(body.memo);
  return data;
}
