import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MINIAPP_TGLINK } from '../telegram/telegram.constants';

// Срок жизни кода-приглашения (аудит 2026-10, T5): колонки expiresAt нет, а
// миграции ради этого не нужны — возраст считается по createdAt.
export const INVITE_TTL_MS = 7 * 24 * 3_600_000;

/** Доменная ошибка: у клиента уже есть активная связь с другим терапевтом. */
export const ALREADY_CONNECTED_ERROR = 'Already connected to another therapist';

const randomCode = (): string => randomBytes(6).toString('hex').toUpperCase();

const inviteUrl = (code: string): string =>
  `${MINIAPP_TGLINK}?startapp=therapy_${code}`;

export async function createTherapyInvite(
  prisma: PrismaService,
  therapistId: bigint,
): Promise<{ code: string; url: string }> {
  // Свежий неиспользованный код этого терапевта отдаём повторно, а не плодим
  // новую pending-строку на каждый вызов (T5): иначе каждый тап «пригласить»
  // оставлял живой код навсегда.
  const fresh = await prisma.therapyRelation.findFirst({
    where: {
      therapistId,
      status: 'pending',
      clientId: null,
      createdAt: { gte: new Date(Date.now() - INVITE_TTL_MS) },
    },
  });
  if (fresh) return { code: fresh.code, url: inviteUrl(fresh.code) };
  let code: string;
  do {
    code = randomCode();
  } while (await prisma.therapyRelation.findUnique({ where: { code } }));
  await prisma.therapyRelation.create({ data: { therapistId, code } });
  return { code, url: inviteUrl(code) };
}

/**
 * true — клиент подключён (или уже подключён к этому терапевту), false — код
 * неизвестен / использован / просрочен / собственный. Бросает
 * ALREADY_CONNECTED_ERROR, если у клиента уже есть активная связь с ДРУГИМ
 * терапевтом: getRelation/UI показывают одну связь, вторая была бы невидимой
 * (аудит 2026-10, T3).
 */
export async function joinTherapyAsClient(
  prisma: PrismaService,
  clientId: bigint,
  code: string,
): Promise<boolean> {
  const rel = await prisma.therapyRelation.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!rel || rel.status !== 'pending' || rel.clientId !== null) return false;
  if (rel.therapistId === clientId) return false;
  // Код без срока жизни — вечный ключ: старше недели считается просроченным (T5).
  if (Date.now() - rel.createdAt.getTime() > INVITE_TTL_MS) return false;
  // Prevent duplicate: if already connected to this therapist, ignore silently
  const alreadyConnected = await prisma.therapyRelation.findFirst({
    where: { therapistId: rel.therapistId, clientId, status: 'active' },
  });
  if (alreadyConnected) return true;
  const otherTherapist = await prisma.therapyRelation.findFirst({
    where: {
      clientId,
      status: 'active',
      therapistId: { not: rel.therapistId },
    },
  });
  if (otherTherapist) throw new Error(ALREADY_CONNECTED_ERROR);
  // Атомарный захват кода: find→update пропускал двух клиентов подряд на один
  // код (второй затирал первого). Условия — в самом UPDATE, выигрывает тот, у
  // кого count === 1 (T5).
  const claimed = await prisma.therapyRelation.updateMany({
    where: {
      code: rel.code,
      status: 'pending',
      clientId: null,
      therapistId: { not: clientId },
    },
    data: { clientId, status: 'active' },
  });
  return claimed.count === 1;
}
