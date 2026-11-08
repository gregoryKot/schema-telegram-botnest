import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { claimTherapyInvite } from './therapy-invite-claim';
import { optionalMiniappStartLink } from '../telegram/miniapp-link';
import { CABINET_URL } from '../telegram/telegram.constants';
import { encryptName } from './client-name';
import { markCardClaim } from './therapy-invite-card-claim';

// Срок жизни кода-приглашения (аудит 2026-10, T5): колонки expiresAt нет, а
// миграции ради этого не нужны — возраст считается по createdAt.
export const INVITE_TTL_MS = 7 * 24 * 3_600_000;

// Длина кода (hex, верхний регистр). Зеркало для полей ввода фронтов —
// THERAPY_INVITE_CODE_LENGTH в shared/src/therapy/inviteCode.ts, сверка —
// therapy-invite-code.parity.spec.ts (правило №4). Инцидент 2026-10-26:
// сервер выдавал 12 знаков, поле ввода пускало 8, и по коду не подключался никто.
export const INVITE_CODE_LENGTH = 12;

// Предел живых (не принятых и не просроченных) приглашений терапевта. До
// 2026-10-26 (T5) повторный вызов отдавал тот же свежий код, чтобы тапы
// «пригласить» не плодили живые коды, — и два клиента подряд получали одну
// ссылку: первый подключался, второй упирался в «неверный код». Теперь каждое
// приглашение — свой код, а число живых держат TTL и этот предел; лишние
// терапевт отзывает в списке «Ждут подключения» (therapy-invite-list.ts).
// Проверка count → create не атомарна: две параллельные вкладки могут дать
// предел + 1 — для мягкого ограничителя это допустимо.
export const MAX_LIVE_INVITES = 20;

/** Доменная ошибка: у клиента уже есть активная связь с другим терапевтом. */
export const ALREADY_CONNECTED_ERROR = 'Already connected to another therapist';
/** Доменная ошибка: живых приглашений уже MAX_LIVE_INVITES. */
export const TOO_MANY_INVITES_ERROR = 'Too many live invites';

const randomCode = (): string =>
  randomBytes(INVITE_CODE_LENGTH / 2)
    .toString('hex')
    .toUpperCase();

/**
 * Ссылки приглашения (аудит 2026-11, U3). `url` — сайт: открывается у любого
 * клиента, после входа любым способом сайт разбирает `?startapp=therapy_…` тем
 * же путём, что ссылку Telegram (useStartParam → экран согласия), — раньше
 * ссылка была только t.me, и клиент без Telegram не подключался. `tgUrl` —
 * приложение в Telegram, второй строкой; бот не настроен — null.
 */
export interface InviteLinks {
  url: string;
  tgUrl: string | null;
}

export const inviteLinks = (code: string): InviteLinks => ({
  url: `${CABINET_URL}?startapp=therapy_${code}`,
  tgUrl: optionalMiniappStartLink(`therapy_${code}`),
});

/** Код, как его ввёл человек: пробелы по краям и внутри, строчные буквы. */
export const normalizeInviteCode = (code: string): string =>
  code.replace(/\s+/g, '').toUpperCase();

/** where живых приглашений терапевта: ждут клиента и ещё не просрочены. */
export const liveInvitesWhere = (therapistId: bigint) => ({
  therapistId,
  status: 'pending' as const,
  clientId: null,
  createdAt: { gte: new Date(Date.now() - INVITE_TTL_MS) },
});

interface InviteRow {
  code: string;
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
  createdAt: Date;
}

/**
 * Можно ли этим кодом подключиться: приглашение ждёт клиента, не просрочено
 * (код без срока — вечный ключ, T5) и не своё. Одно правило для подключения
 * и для предпросмотра на экране согласия.
 */
export function isClaimableInvite(
  rel: InviteRow | null,
  clientId: bigint,
): rel is InviteRow {
  if (!rel || rel.status !== 'pending' || rel.clientId !== null) return false;
  if (rel.therapistId === clientId) return false;
  return Date.now() - rel.createdAt.getTime() <= INVITE_TTL_MS;
}

/**
 * Новое приглашение — всегда новый код. `alias` — имя, которое терапевт ввёл
 * в «Новый клиент»: ложится в clientAlias приглашения, и после подключения
 * карточка клиента одна и называется так, как назвал терапевт. `attachToId` —
 * приглашение из карточки офлайн-клиента: её данные переедут на аккаунт
 * после сверки терапевтом (therapy-invite-card-claim.ts). Бросает
 * TOO_MANY_INVITES_ERROR.
 */
export async function createTherapyInvite(
  prisma: PrismaService,
  therapistId: bigint,
  alias?: string,
  attachToId?: number,
): Promise<{ code: string } & InviteLinks> {
  const live = await prisma.therapyRelation.count({
    where: liveInvitesWhere(therapistId),
  });
  if (live >= MAX_LIVE_INVITES) throw new Error(TOO_MANY_INVITES_ERROR);
  let code: string;
  do {
    code = randomCode();
  } while (await prisma.therapyRelation.findUnique({ where: { code } }));
  await prisma.therapyRelation.create({
    data: { therapistId, code, clientAlias: encryptName(alias), attachToId },
  });
  return { code, ...inviteLinks(code) };
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
    where: { code: normalizeInviteCode(code) },
  });
  if (!isClaimableInvite(rel, clientId)) return false;
  const alreadyConnected = await prisma.therapyRelation.findFirst({
    where: { therapistId: rel.therapistId, clientId, status: 'active' },
  });
  // Код офлайн-карточки (S8): данные карточки НЕ переезжают — связь (новая
  // или уже живая) ждёт, пока терапевт подтвердит «это тот же человек»
  // (therapy-invite-card-claim.ts). Уже подключён без карточки — молча true.
  if (alreadyConnected) {
    if (rel.attachToId != null)
      await markCardClaim(prisma, rel.id, rel.attachToId, alreadyConnected.id);
    return true;
  }
  const otherTherapist = await prisma.therapyRelation.findFirst({
    where: {
      clientId,
      status: 'active',
      therapistId: { not: rel.therapistId },
    },
  });
  if (otherTherapist) throw new Error(ALREADY_CONNECTED_ERROR);
  return claimTherapyInvite(prisma, rel.code, clientId, rel.attachToId != null);
}
