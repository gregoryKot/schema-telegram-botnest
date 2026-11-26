// Привязка почты кодом из письма — для экрана, где ссылка из письма не
// поможет: приложение открыто внутри Telegram или MAX, а письмо открывается в
// другом браузере (email-link-code.ts). Отдельный контроллер: соседний
// auth-account.controller.ts у потолка размера (правило №10).
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
import { CODE_THROTTLE } from './auth-throttles';
import { requireCsrf } from './auth-http.util';
import { UserCodeDto } from './dto/login-ticket.dto';
import { EmailLinkCodeService } from './email-link-code.service';
import { JwtAuthGuard } from './jwt.guard';
import { SecurityLogService } from './security-log.service';
import { SecurityNoticeService } from './security-notice.service';

@Controller('api/auth')
export class AuthEmailCodeController {
  constructor(
    private readonly codes: EmailLinkCodeService,
    private readonly securityLog: SecurityLogService,
    private readonly notice: SecurityNoticeService,
  ) {}

  // Step-up здесь не нужен: его прошёл запрос письма (email/link-to-account),
  // а код живёт 30 минут и годен только сессии того же аккаунта. Лимит —
  // кодовый, общий на инстансы (№5): короткий код перебирают.
  @Post('email/link-code')
  @UseGuards(JwtAuthGuard)
  @PersistentThrottleLimit(CODE_THROTTLE)
  @HttpCode(200)
  async confirm(
    @Body() dto: UserCodeDto,
    @Req() req: Request,
  ): Promise<{ linked: true }> {
    requireCsrf(req, 'email/link-code', this.securityLog);
    const userId = req.webUser!.userId;
    await this.codes.confirm(userId, dto.code);
    this.securityLog.log('provider_linked', {
      userId,
      provider: 'email',
      ip: req.ip,
    });
    this.notice.linked(userId, 'email');
    return { linked: true };
  }
}
