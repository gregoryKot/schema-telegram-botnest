import { PrismaService } from '../prisma/prisma.service';
import { THERAPIST_RESIGNED } from './relation-end-reason';
import { therapistName } from './therapist-name';

// Бывший терапевт клиента (GET /api/therapy/former-therapist, решение владельца
// 2026-10-22): после отказа терапевта от роли «Мой терапевт» пропадает, и клиент
// видит вместо него сообщение «… больше не работает в приложении как терапевт».
// GET /api/therapy/relation не трогаем: его null по всему фронту значит
// «терапевта нет».
//
// null, когда сообщение не нужно: у клиента есть живая связь (active или
// pending — подключён новый терапевт) либо нет связи, завершённой отказом
// терапевта от роли. Иначе — последняя такая связь. Строк у одного клиента —
// по одной на бывшего терапевта, поэтому порядок считается здесь, а не в SQL:
// NULLS LAST по endedAt (у старых связей даты нет) одинаков на Postgres и фейке.
export interface FormerTherapistInfo {
  name: string;
  endedAt: string | null;
}

export async function getFormerTherapistInfo(
  prisma: PrismaService,
  clientId: bigint,
): Promise<FormerTherapistInfo | null> {
  const live = await prisma.therapyRelation.count({
    where: { clientId, status: { in: ['active', 'pending'] } },
  });
  if (live > 0) return null;
  const rows = await prisma.therapyRelation.findMany({
    where: { clientId, status: 'ended', endReason: THERAPIST_RESIGNED },
    include: { therapist: { select: { firstName: true } } },
  });
  const latest = [...rows].sort(byLatestEnd)[0];
  if (!latest) return null;
  return {
    name: therapistName(latest.therapist) ?? '',
    endedAt: latest.endedAt ? latest.endedAt.toISOString() : null,
  };
}

type Ended = { endedAt?: Date | null; createdAt?: Date | null };

const ms = (d: Date | null | undefined): number | null =>
  d ? d.getTime() : null;

/** endedAt по убыванию, пустые в конце; при равенстве — createdAt по убыванию. */
export function byLatestEnd(a: Ended, b: Ended): number {
  const ea = ms(a.endedAt);
  const eb = ms(b.endedAt);
  if (ea !== eb) {
    if (ea === null) return 1;
    if (eb === null) return -1;
    return eb - ea;
  }
  return (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0);
}
