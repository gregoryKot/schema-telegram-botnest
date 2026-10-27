import { PrismaService } from '../prisma/prisma.service';
import { decryptName } from './client-name';
import { therapistName } from './therapist-name';
import {
  INVITE_TTL_MS,
  inviteUrl,
  isClaimableInvite,
  liveInvitesWhere,
  normalizeInviteCode,
} from './therapy-invite';

// Приглашения глазами двух сторон (инцидент 2026-10-26):
// - терапевт видит свои живые приглашения списком «Ждут подключения» — с
//   именем, которое ввёл в «Новый клиент», кодом и ссылкой — и может отозвать
//   лишнее (так держится предел MAX_LIVE_INVITES вместо повторной выдачи
//   одного кода);
// - клиент на экране согласия видит, ЧЕЙ код открывает доступ к его записям.
// Подключение и выдача кода — therapy-invite.ts.

export interface TherapyInviteView {
  id: number;
  code: string;
  url: string;
  /** Имя клиента, которое терапевт ввёл при создании; null — без имени. */
  alias: string | null;
  createdAt: string;
  /** Когда код перестанет действовать (createdAt + INVITE_TTL_MS). */
  expiresAt: string;
}

export async function listTherapyInvites(
  prisma: PrismaService,
  therapistId: bigint,
): Promise<TherapyInviteView[]> {
  const rows = await prisma.therapyRelation.findMany({
    where: liveInvitesWhere(therapistId),
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    url: inviteUrl(r.code),
    alias: decryptName(r.clientAlias),
    createdAt: r.createdAt.toISOString(),
    expiresAt: new Date(r.createdAt.getTime() + INVITE_TTL_MS).toISOString(),
  }));
}

/**
 * Отзыв приглашения: удаляется только своё и только ждущее клиента — чужой id
 * или уже принятая связь не задеваются (where со скоупом по владельцу).
 */
export async function revokeTherapyInvite(
  prisma: PrismaService,
  therapistId: bigint,
  id: number,
): Promise<boolean> {
  const res = await prisma.therapyRelation.deleteMany({
    where: { id, therapistId, status: 'pending', clientId: null },
  });
  return res.count > 0;
}

/**
 * Чей это код — до согласия. null — по коду подключиться нельзя (неизвестен,
 * принят, просрочен, свой): то же правило, что у подключения. Имя — как в
 * «Мой терапевт» (therapist-name.ts), null, если в профиле его нет.
 */
export async function previewTherapyInvite(
  prisma: PrismaService,
  clientId: bigint,
  code: string,
): Promise<{ therapistName: string | null } | null> {
  const rel = await prisma.therapyRelation.findUnique({
    where: { code: normalizeInviteCode(code) },
    include: { therapist: { select: { firstName: true } } },
  });
  if (!isClaimableInvite(rel, clientId)) return null;
  return { therapistName: therapistName(rel.therapist) };
}
