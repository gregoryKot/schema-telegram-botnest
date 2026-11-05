// Handoff: сайт внутри Telegram/MAX просит билет, УЖЕ подтверждённый его же
// аккаунтом, и открывает во внешнем браузере `/install#h=<deviceCode>`;
// страница забирает сессию обычным `POST api/auth/ticket/poll`.
//
// Код едет в URL, поэтому TTL всего 120 с и билет одноразовый. Публичного
// «approve» для него нет: подтверждение происходит при выписке, по проверенной
// сессии. Отдельный контроллер с тем же префиксом — чтобы не раздувать
// AuthTicketController (правило №10); маршруты не пересекаются.
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PersistentThrottleLimit } from '../api/persistent-throttle-limit';
import { JwtAuthGuard } from './jwt.guard';
import { LoginTicketService } from './login-ticket/login-ticket.service';
import { deviceLabel } from './login-ticket/device-label';
import { HandoffTicketDto } from './dto/handoff-ticket.dto';
import { requireCsrf } from './auth-http.util';
import { SecurityLogService } from './security-log.service';

/** 5 в минуту и 20 в час: каждый вызов — строка в БД и одноразовая ссылка
 *  входа в аккаунт. Бакет — по проверенной сессии (правило №5). */
export const HANDOFF_THROTTLE = {
  short: { limit: 5, ttl: 60_000 },
  long: { limit: 20, ttl: 3_600_000 },
} as const;

@Controller('api/auth/ticket')
export class AuthTicketHandoffController {
  constructor(
    private readonly tickets: LoginTicketService,
    private readonly securityLog: SecurityLogService,
  ) {}

  @Post('handoff')
  @UseGuards(JwtAuthGuard)
  @PersistentThrottleLimit(HANDOFF_THROTTLE)
  @HttpCode(200)
  async handoff(
    @Body() body: HandoffTicketDto,
    @Req() req: Request,
  ): Promise<{ deviceCode: string; expiresIn: number }> {
    requireCsrf(req, 'ticket/handoff', this.securityLog);
    return this.tickets.handoff({
      userId: req.webUser!.userId,
      hostId: body.hostId ?? 'telegram',
      deviceLabel: deviceLabel(req.headers['user-agent']),
    });
  }
}
