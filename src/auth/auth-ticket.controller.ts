// Билет входа по HTTP: выписать, показать, подтвердить, забрать сессию.
// Логика — в src/auth/login-ticket/, здесь только HTTP, охрана и троттлинг.
//
// Пришёл на место `api/auth/device-link` (тот же механизм, RFC 8628, просто
// теперь ещё и для входа) — прежний контроллер удалён в этом же PR, чтобы не
// осталось второго живого маршрута к той же логике (CLAUDE.md, правило №11).
//
// Троттлинг тут важнее обычного. Короткий код можно перебирать, а флоу с кодом
// исторически ломают социальной инженерией («введите код для проверки
// безопасности») — так ходили в Microsoft 365 и в WhatsApp. Против перебора
// стоят лимиты ниже, против уговоров — сверка кода и экран preview, которые
// показывают человеку, что именно он сейчас отдаёт.
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt.guard';
import { LoginTicketService } from './login-ticket/login-ticket.service';
import { TicketLinkService } from './login-ticket/ticket-link.service';
import { deviceLabel } from './login-ticket/device-label';
import type { LinkPreview } from './login-ticket/login-ticket.types';
import {
  DeviceCodeDto,
  StartTicketDto,
  UserCodeDto,
} from './dto/login-ticket.dto';
import {
  isCrossSiteSession,
  requireCsrf,
  setRefreshCookie,
} from './auth-http.util';
import { SecurityLogService } from './security-log.service';

const REFRESH_MAX_AGE_S = 30 * 24 * 3600;

@Controller('api/auth/ticket')
export class AuthTicketController {
  constructor(
    private readonly tickets: LoginTicketService,
    private readonly links: TicketLinkService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // ─── Шаг 1: контейнер просит билет ────────────────────────────────────────
  // OptionalJwtGuard, а не два разных роута: механизм один, разница только в
  // том, есть ли у просящего сессия. Привязка без сессии бессмысленна — к чему
  // привязывать, — поэтому такой запрос отбивается сразу.
  @Post('start')
  @UseGuards(OptionalJwtGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 30, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async start(
    @Body() body: StartTicketDto,
    @Req() req: Request,
  ): Promise<{
    deviceCode: string;
    userCode: string;
    expiresIn: number;
    interval: number;
  }> {
    const requesterUserId = req.webUser?.userId ?? null;
    if (body.intent === 'link' && !requesterUserId) {
      throw new UnauthorizedException('Привязка требует входа');
    }
    return this.tickets.start({
      intent: body.intent,
      provider: body.provider,
      // Вход всегда начинается с чистого листа: даже если сессия почему-то
      // есть, билет входа не должен наследовать её хозяина.
      requesterUserId: body.intent === 'link' ? requesterUserId : null,
      hostId: body.hostId ?? 'web',
      deviceLabel: deviceLabel(req.headers['user-agent']),
    });
  }

  // ─── Шаг 2: подтверждающий смотрит, что произойдёт ────────────────────────
  @Post('preview')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 10, ttl: 60_000 },
    long: { limit: 60, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async preview(
    @Body() body: UserCodeDto,
    @Req() req: Request,
  ): Promise<LinkPreview> {
    return this.links.preview(body.code, req.webUser!.userId);
  }

  // ─── Шаг 3: человек подтвердил привязку в браузере ────────────────────────
  // Вход (`intent: 'login'`) сюда не ходит: его подтверждает бот со сверкой
  // кода, а OAuth — сервер в своём callback. Публичного роута «одобрить вход»
  // не существует, и это намеренно.
  @Post('approve')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async approve(
    @Body() body: UserCodeDto,
    @Req() req: Request,
  ): Promise<{ merged: boolean }> {
    requireCsrf(req, 'ticket/approve', this.securityLog);
    return this.links.approve(body.code, req.webUser!.userId, req.ip);
  }

  // ─── Шаг 4: контейнер забирает сессию ─────────────────────────────────────
  // Без JwtAuthGuard: длинный код и есть доказательство — так же устроен token
  // endpoint в RFC 8628. При входе сессии у контейнера ещё нет вовсе, а при
  // привязке аккаунт, под которым начинали, к этому моменту уже слит и его
  // токен ничего не докажет.
  @Post('poll')
  @Throttle({
    short: { limit: 40, ttl: 60_000 },
    long: { limit: 200, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async poll(
    @Body() body: DeviceCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    status: string;
    accessToken?: string;
    expiresIn?: number;
  }> {
    const result = await this.tickets.poll(
      body.deviceCode,
      req.ip,
      req.headers['user-agent'],
    );
    if (result.status !== 'linked') return { status: result.status };

    setRefreshCookie(
      res,
      result.tokens.refreshToken,
      REFRESH_MAX_AGE_S,
      isCrossSiteSession(req),
    );
    return {
      status: 'linked',
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }
}
