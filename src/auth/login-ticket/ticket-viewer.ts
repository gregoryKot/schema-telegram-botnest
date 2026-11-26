// Кому разрешено действовать по карточке сверки в Telegram.
//
// Карточка входа/привязки уходит в чат с кнопками «Это я» / «Это не я».
// Без привязки к тому, кому её показали, её мог нажать любой, кто увидел
// карточку (группа, пересланное сообщение): человек отдавал свою сессию
// браузеру того, кто начал вход, а при `link_` чужая личность сливалась с его
// аккаунтом (аудит 2026-10, B1).
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SecurityLogService } from '../security-log.service';

/**
 * @param shownTo  сырой telegramId, закрепленный при показе карточки (null —
 *                 в Telegram билет не показывали)
 * @param via      сырой telegramId нажавшего. undefined — действие не из
 *                 Telegram (HTTP с проверенной сессией, MAX initData): там
 *                 личность подтверждена подписью, сверять нечего.
 */
export function viewerMayAct(
  shownTo: bigint | null,
  via: bigint | undefined,
): boolean {
  if (via === undefined) return true;
  // Нажатие из Telegram по карточке, которую мы никому не закрепили, —
  // значит карточка не наша (или показана до выкладки привязки): отказ.
  return shownTo !== null && shownTo === via;
}

interface ViewedRow {
  id: string;
  intent: string;
  shownToTelegramId: bigint | null;
}
type TicketLog = Pick<SecurityLogService, 'log'> | undefined;

/**
 * Сверка «карточку нажал тот, кому её показали». `via` — СЫРОЙ telegramId
 * нажавшего (не канонический: после слияния они расходятся, а карточке
 * закрепляем именно сырой). Без него (HTTP с проверенной сессией, MAX
 * initData) проверки нет. Чужое нажатие неотличимо от «код не найден».
 */
export function assertTicketViewer(
  securityLog: TicketLog,
  row: ViewedRow,
  via: bigint | undefined,
): void {
  if (viewerMayAct(row.shownToTelegramId, via)) return;
  securityLog?.log('login_ticket_cross_user', {
    intent: row.intent,
    shownTo: row.shownToTelegramId,
    actor: via,
  });
  throw new BadRequestException('Код не найден или истёк');
}

/** Атомарно закрепляет билет за первым увидевшим; true — билет его. */
export async function claimTicketView(
  prisma: PrismaService,
  securityLog: TicketLog,
  row: ViewedRow,
  viewer: bigint | undefined,
): Promise<boolean> {
  // Не из Telegram (MAX, веб) — закреплять нечего.
  if (viewer === undefined) return true;
  let shownTo = row.shownToTelegramId;
  if (shownTo === null) {
    const claimed = await prisma.loginTicket.updateMany({
      where: { id: row.id, shownToTelegramId: null },
      data: { shownToTelegramId: viewer },
    });
    if (claimed.count === 1) return true;
    // Гонка: между чтением и записью билет закрепил другой.
    const fresh = await prisma.loginTicket.findUnique({
      where: { id: row.id },
    });
    shownTo = fresh?.shownToTelegramId ?? null;
  }
  if (shownTo === viewer) return true;
  securityLog?.log('login_ticket_cross_user', {
    intent: row.intent,
    shownTo,
    actor: viewer,
    step: 'show',
  });
  return false;
}
