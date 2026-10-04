import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationInfo } from './therapy.types';

// Статус связи терапевт↔клиент «глазами» пользователя (экран «Мой терапевт»).
// Вынесено из therapy-relations.service.ts (правило №10: сервис упирался в
// потолок размера).
//
// Связи «в роли терапевта» ищем, только если человек СЕЙЧАС терапевт (A-3,
// аудит 2026-10): у вышедшего из роли (CLIENT) остаются старые строки со
// стороны терапевта, и «Мой терапевт» показывал бы его бывшего клиента, а
// «Отключиться» (disconnect удаляет только связи, где он клиент) ничего бы не
// делал. Не терапевт — смотрим только связь со стороны клиента.
export async function getRelationInfo(
  prisma: PrismaService,
  uid: bigint,
): Promise<TherapyRelationInfo | null> {
  const me = await prisma.user.findUnique({
    where: { id: uid },
    select: { role: true },
  });
  const asTherapist =
    me?.role === 'THERAPIST'
      ? await prisma.therapyRelation.findFirst({
          where: { therapistId: uid, status: 'active' },
          include: { client: { select: { firstName: true } } },
        })
      : null;
  if (asTherapist) {
    return {
      role: 'therapist',
      status: 'active',
      partnerName: asTherapist.client?.firstName ?? null,
      partnerId: asTherapist.clientId ?? null,
      code: asTherapist.code,
      nextSession: null,
    };
  }
  const asClient = await prisma.therapyRelation.findFirst({
    where: { clientId: uid, status: 'active' },
    include: { therapist: { select: { id: true, firstName: true } } },
  });
  if (!asClient) return null;
  return {
    role: 'client',
    status: 'active',
    partnerName: asClient.therapist?.firstName ?? null,
    partnerId: asClient.therapist?.id ?? null,
    code: asClient.code,
    nextSession: asClient.nextSession ?? null,
  };
}
