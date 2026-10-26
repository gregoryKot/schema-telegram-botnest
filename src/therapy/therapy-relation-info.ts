import { PrismaService } from '../prisma/prisma.service';
import { TherapyRelationInfo } from './therapy.types';
import { therapistName } from './therapist-name';

// Статус связи терапевт↔клиент «глазами» пользователя (экран «Мой терапевт»).
// Роль партнёра сверяется с обеих сторон. Терапевт: у вышедшего из роли
// остаются старые строки (A-3, аудит 2026-10). Клиент: бывшего терапевта здесь
// нет (backend#33) — о нём говорит former-therapist-info.ts. Клиенту — и дни
// встреч: ближайшую встречу экраны считают сами (shared upcomingSession), без
// них прошедшая nextSession висела как «следующая» (2026-10-26).
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
      meetingDays: [],
    };
  }
  const rows = await prisma.therapyRelation.findMany({
    where: { clientId: uid, status: 'active' },
    include: {
      therapist: { select: { id: true, firstName: true, role: true } },
    },
  });
  const asClient = rows.find((r) => r.therapist?.role === 'THERAPIST');
  if (!asClient) return null;
  return {
    role: 'client',
    status: 'active',
    partnerName: therapistName(asClient.therapist),
    partnerId: asClient.therapist?.id ?? null,
    code: asClient.code,
    nextSession: asClient.nextSession ?? null,
    meetingDays: meetingDaysOf(asClient.meetingDays),
  };
}

// Json-колонка: доверяем только массиву дней недели 0–6 (0 = Вс), остальное
// отбрасываем — старая или битая строка не роняет экран клиента.
export function meetingDaysOf(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is number => Number.isInteger(d) && d >= 0 && d <= 6,
  );
}
