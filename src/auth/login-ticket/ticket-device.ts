// Чей это билет входа — браузера, который его выписал (S9, аудит 2026-11).
//
// Атака: выписать билет у себя и отправить его код в `POST email/link
// {email: жертвы, ticket}` — сервер присылал жертве НАСТОЯЩЕЕ письмо с чужим
// кодом, а подтверждение на `/auth/confirm` отдавало её сессию опросу
// атакующего. Теперь `ticket/start` ставит httpOnly-куку с хешем длинного
// секрета, и письмо с билетом уходит, только если кука того же браузера
// совпадает с билетом. Чужой билет — 400 `ticket_foreign`, письма нет: тихо
// выбросить билет и всё равно послать письмо значило бы по-прежнему слать
// жертве письма по заказу атакующего, а громкий отказ виден в журнале.
//
// OAuth-путь (`/api/auth/google?ticket=`) так не закрыть: его по замыслу
// открывает ДРУГОЙ контейнер (мини-апп уводит во внешний браузер, у ярлыка
// своя банка кук), куки там нет. Там защищает экран `/auth/confirm`: код
// набирается руками, видно устройство и время (`preview` ниже).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityLogService } from '../security-log.service';
import { cookieOptions, getCookie } from '../auth-http.util';
import { hashToken } from '../email.util';
import { TTL_S } from './login-ticket.service';

export const TICKET_DEVICE_COOKIE = 'login_ticket';
export const TICKET_FOREIGN_REASON = 'ticket_foreign';

/** Что видит человек на экране сверки входа. */
export interface LoginTicketPreview {
  deviceLabel: string | null;
  createdAt: string;
}

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

@Injectable()
export class TicketDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityLog: SecurityLogService,
  ) {}

  /** Выписка: браузер запоминает хеш секрета на срок жизни билета. */
  bind(res: Response, deviceCode: string): void {
    res.cookie(
      TICKET_DEVICE_COOKIE,
      hashToken(deviceCode),
      cookieOptions(TTL_S),
    );
  }

  /** Билет из письма входа: свой, живой и ждёт входа — иначе 400. */
  async assertOwnPendingLogin(req: Request, userCode: string): Promise<void> {
    const row = await this.pendingLogin(userCode);
    const mine = getCookie(req, TICKET_DEVICE_COOKIE);
    if (row && mine && sameHash(mine, row.deviceCodeHash)) return;
    this.securityLog.log('login_ticket_foreign', {
      ip: req.ip,
      reason: row ? 'other_device' : 'no_pending_ticket',
    });
    throw new BadRequestException({
      message: 'Код входа выписан на другом устройстве',
      reason: TICKET_FOREIGN_REASON,
    });
  }

  /** Экран /auth/confirm: какое устройство и когда просило вход; иначе 404. */
  async preview(userCode: string): Promise<LoginTicketPreview> {
    const row = await this.pendingLogin(userCode);
    if (!row) throw new NotFoundException();
    return {
      deviceLabel: row.deviceLabel || null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // Только вход (handoff короткий код никому не показывает, привязка
  // сверяется своим preview), не погашенный, не отклонённый, не одобренный.
  private async pendingLogin(userCode: string) {
    const row = await this.prisma.loginTicket.findUnique({
      where: { userCodeHash: hashToken(userCode.trim().toUpperCase()) },
    });
    if (!row || row.intent !== 'login') return null;
    if (row.consumedAt || row.deniedAt || row.approvedUserId !== null)
      return null;
    return row.expiresAt < new Date() ? null : row;
  }
}
