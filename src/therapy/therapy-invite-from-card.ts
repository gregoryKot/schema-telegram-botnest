import { PrismaService } from '../prisma/prisma.service';
import { decryptName } from './client-name';
import { activeRelationWhere } from './relation-where';
import {
  createTherapyInvite,
  inviteLinks,
  type InviteLinks,
  liveInvitesWhere,
} from './therapy-invite';

// Приглашение из карточки офлайн-клиента. В отличие от обычного POST /invite
// (каждый вызов — новый код, инцидент 2026-10-26) оно привязано к одному
// человеку: повторный тап «Пригласить» возвращает уже живой код карточки.
// created — писать ли событие воронки (только для нового кода).
export async function createInviteFromCard(
  prisma: PrismaService,
  therapistId: bigint,
  cid: bigint,
): Promise<{ code: string; created: boolean } & InviteLinks> {
  const card =
    cid < 0n
      ? await prisma.therapyRelation.findFirst({
          where: activeRelationWhere(therapistId, cid),
        })
      : null;
  if (!card || card.virtualClientName == null)
    throw new Error('No active relation');
  const live = await prisma.therapyRelation.findFirst({
    where: { ...liveInvitesWhere(therapistId), attachToId: card.id },
    orderBy: { createdAt: 'desc' },
  });
  if (live)
    return { code: live.code, ...inviteLinks(live.code), created: false };
  const made = await createTherapyInvite(
    prisma,
    therapistId,
    decryptName(card.virtualClientName) ?? undefined,
    card.id,
  );
  return { ...made, created: true };
}
