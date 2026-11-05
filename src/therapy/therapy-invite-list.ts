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
  /** id офлайн-карточки, из которой создано приглашение; null — обычное. */
  attachToId: number | null;
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
    attachToId: r.attachToId ?? null,
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
 * Подключение клиента на момент предпросмотра (QA 2026-11, М1): `same` — он
 * уже подключён к терапевту этой ссылки (новая ссылка не нужна), `other` — к
 * другому (присоединиться не выйдет, пока не отключится), `none` — связи нет.
 * Это его собственная связь: чужого предпросмотр не выдаёт.
 */
export type InviteConnection = 'none' | 'same' | 'other';

export interface InvitePreview {
  therapistName: string | null;
  connection: InviteConnection;
}

/**
 * Чей это код — до согласия. null — по коду подключиться нельзя (неизвестен,
 * чужой принятый, просрочен, свой): то же правило, что у подключения. Код,
 * которым этот клиент уже подключился, — не «недействителен», а `same`:
 * повторный переход по ссылке говорил «попросите новую», хотя связь есть.
 * Имя — как в «Мой терапевт» (therapist-name.ts), null, если его нет.
 */
export async function previewTherapyInvite(
  prisma: PrismaService,
  clientId: bigint,
  code: string,
): Promise<InvitePreview | null> {
  const rel = await prisma.therapyRelation.findUnique({
    where: { code: normalizeInviteCode(code) },
    include: { therapist: { select: { firstName: true } } },
  });
  const name = rel ? therapistName(rel.therapist) : null;
  if (rel?.status === 'active' && rel.clientId === clientId)
    return { therapistName: name, connection: 'same' };
  if (!isClaimableInvite(rel, clientId)) return null;
  const active = await prisma.therapyRelation.findFirst({
    where: { clientId, status: 'active' },
    select: { therapistId: true },
  });
  const connection: InviteConnection = !active
    ? 'none'
    : active.therapistId === rel.therapistId
      ? 'same'
      : 'other';
  return { therapistName: name, connection };
}
