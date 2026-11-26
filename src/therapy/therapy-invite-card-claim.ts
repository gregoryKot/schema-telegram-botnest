import type { AnalyticsService } from '../analytics/analytics.service';
import { THERAPY_INVITE_EVENT } from '../analytics/therapy-invite-events.constants';
import { PrismaService } from '../prisma/prisma.service';
import { decryptName } from './client-name';
import { attachOfflineCard } from './therapy-invite-attach';

// Сверка «Это тот же человек?» для кода из офлайн-карточки (аудит 2026-11, S8;
// решение владельца Р3 2026-11-08). Код приглашения из карточки мог ввести
// кто угодно, у кого он оказался, — раньше этот аккаунт сразу получал задания
// и карты режимов карточки и показывался психологу под её именем. Теперь join
// только создаёт связь (или находит уже живую) и ставит на неё attachToId
// карточки: активная связь с клиентом и attachToId — «ждёт сверки». Записи
// карточки остаются на отрицательном id и клиенту не видны, пока психолог не
// ответит в кабинете: «Да» — attachOfflineCard, «Нет» — отметка снимается,
// карточка остаётся офлайн.
//
// FK attachToId — с каскадом (приглашения карточки уходят вместе с ней),
// поэтому всё, что удаляет карточку (remove-client.ts, attachOfflineCard),
// сначала снимает отметку со связей клиентов — иначе каскад снёс бы и связь.

export interface CardClaimView {
  /** Аккаунт, который ввёл код (bigint → JSON, utils/bigint-json.ts). */
  clientId: bigint;
  /** Как психолог видит этот аккаунт в списке: своё имя для него или имя аккаунта. */
  clientName: string | null;
  cardId: number;
  /** Имя офлайн-карточки; null — не расшифровалось. */
  cardName: string | null;
}

/**
 * Уже подключённый клиент ввёл код карточки: код гаснет, его связь ждёт
 * сверки. Код гасится тем же условием, что захват (claimTherapyInvite), — из
 * двух параллельных вводов отметку ставит один.
 */
export async function markCardClaim(
  prisma: PrismaService,
  inviteId: number,
  cardId: number,
  relationId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const used = await tx.therapyRelation.deleteMany({
      where: { id: inviteId, status: 'pending', clientId: null },
    });
    if (used.count === 1)
      await tx.therapyRelation.update({
        where: { id: relationId },
        data: { attachToId: cardId },
      });
  });
}

/** Связи психолога, ждущие сверки, — плашки над списком клиентов. */
export async function listCardClaims(
  prisma: PrismaService,
  therapistId: bigint,
): Promise<CardClaimView[]> {
  const rows = await prisma.therapyRelation.findMany({
    where: {
      therapistId,
      status: 'active',
      clientId: { not: null },
      attachToId: { not: null },
    },
    include: { client: { select: { firstName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (rows.length === 0) return [];
  const cards = await prisma.therapyRelation.findMany({
    where: {
      therapistId,
      clientId: null,
      id: { in: rows.map((r) => r.attachToId as number) },
    },
    select: { id: true, virtualClientName: true },
  });
  const cardName = new Map(
    cards.map((c) => [c.id, decryptName(c.virtualClientName)]),
  );
  return rows
    .filter((r) => cardName.has(r.attachToId as number))
    .map((r) => ({
      clientId: r.clientId as bigint,
      clientName: decryptName(r.clientAlias) ?? r.client?.firstName ?? null,
      cardId: r.attachToId as number,
      cardName: cardName.get(r.attachToId as number) ?? null,
    }));
}

/**
 * Ответ психолога. true — сделано; false — такой сверки у этого психолога
 * нет (чужой клиент, уже ответили, другая карточка) или карточки уже нет.
 */
export async function resolveCardClaim(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
  cardId: number,
  accept: boolean,
): Promise<boolean> {
  if (clientId <= 0n) return false;
  const rel = await prisma.therapyRelation.findFirst({
    where: { therapistId, clientId, status: 'active', attachToId: cardId },
    select: { id: true },
  });
  if (!rel) return false;
  if (
    accept &&
    (await attachOfflineCard(prisma, therapistId, clientId, cardId))
  )
    return true;
  // «Нет» (или карточки уже нет): отметка снимается, карточка остаётся офлайн.
  const { count } = await prisma.therapyRelation.updateMany({
    where: { id: rel.id, attachToId: cardId },
    data: { attachToId: null },
  });
  return !accept && count === 1;
}

/** Шаг воронки therapy_invite: психолог ответил на сверку (правило №8). */
export function trackCardClaim(
  analytics: AnalyticsService,
  therapistId: bigint,
  accept: boolean,
): Promise<void> {
  return analytics.track(therapistId, THERAPY_INVITE_EVENT, {
    step: accept ? 'confirmed' : 'denied',
    kind: 'offline',
  });
}
