// Подтверждение билета человеком: общая половина входа и привязки.
//
// Повторное «Это я» тем же человеком — не ошибка. Двойной тап, второй экран
// бота, вторая вкладка: пока подтверждение состоялось, ложный провал после
// успеха хуже молчания (человек решает, что данные пропали). Раньше
// идемпотентность была только у входа, у привязки — нет (аудит 2026-10).
// Две копии одной механики разъехались, поэтому она живёт здесь, а не в
// каждом сервисе.
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { LoginTicket } from '@prisma/client';
import type { LoginTicketService } from './login-ticket.service';
import { viewerMayAct } from './ticket-viewer';

export type ApprovalClaim = 'claimed' | 'repeat';

interface ApprovedRow {
  id: string;
}

/**
 * Атомарно записывает подтверждение. 'claimed' — это сделали мы и дальше
 * наша работа (перенос данных, отчёт воронки); 'repeat' — тот же человек уже
 * подтвердил (раньше или параллельно), делать больше нечего. Чужой — отказ.
 *
 * Условие `approvedUserId IS NULL` внутри самой записи, а не проверка после
 * чтения: два тапа из одной пачки обновлений Telegram читают строку до того,
 * как первый успел записать, и «прочитал — потом записал» пропускает обоих.
 */
export async function claimApproval(
  prisma: PrismaService,
  row: ApprovedRow,
  userId: bigint,
  extra: { userId?: bigint } = {},
): Promise<ApprovalClaim> {
  const claimed = await prisma.loginTicket.updateMany({
    where: {
      id: row.id,
      approvedUserId: null,
      deniedAt: null,
      consumedAt: null,
    },
    data: { approvedUserId: userId, approvedAt: new Date(), ...extra },
  });
  if (claimed.count === 1) return 'claimed';

  // Проиграли гонку (или код уже занят): кто победил — решает перечитанная
  // строка, а не наше допущение.
  const fresh = await prisma.loginTicket.findUnique({ where: { id: row.id } });
  if (fresh?.approvedUserId === userId) return 'repeat';
  if (fresh?.approvedUserId) {
    throw new BadRequestException('Код уже подтверждён');
  }
  // Строка исчезла, отклонена или погашена между чтением и записью.
  throw new BadRequestException('Код не найден или истёк');
}

/** Что нужно, чтобы найти билет к подтверждению (LoginTicketService — `this`). */
interface TicketAccess {
  prisma: PrismaService;
  tickets: Pick<LoginTicketService, 'hash' | 'liveByUserCode'>;
}

/**
 * Билет к подтверждению — или null, если подтверждать уже нечего.
 *
 * null — повторный тап ПОСЛЕ того, как приложение забрало сессию опросом:
 * строка погашена, и `liveByUserCode` ответил бы «Код не найден или истёк» —
 * ложным провалом на карточке, которая только что сработала. Отвечаем так
 * только тому, кто подтвердил сам, и только если ему же эту карточку
 * показывали (`viewerMayAct`): иначе повтор стал бы оракулом «этот код кто-то
 * подтверждал». Всё остальное — обычный путь с обычным отказом.
 */
export async function loadForApproval(
  { prisma, tickets }: TicketAccess,
  userCode: string,
  who: { userId: bigint; intent: 'login' | 'link'; via?: bigint },
): Promise<LoginTicket | null> {
  const consumed = await prisma.loginTicket.findUnique({
    where: { userCodeHash: tickets.hash(userCode.trim().toUpperCase()) },
  });
  if (
    consumed?.consumedAt &&
    !consumed.deniedAt &&
    consumed.expiresAt >= new Date() &&
    consumed.intent === who.intent &&
    consumed.approvedUserId === who.userId &&
    viewerMayAct(consumed.shownToTelegramId, who.via)
  ) {
    return null;
  }
  const row = await tickets.liveByUserCode(userCode, who.via);
  if (row.intent !== who.intent) {
    throw new BadRequestException(
      who.intent === 'login'
        ? 'Этот код не для входа'
        : 'Этот код не для привязки',
    );
  }
  return row;
}
