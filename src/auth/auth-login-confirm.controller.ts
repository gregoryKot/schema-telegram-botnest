// Подтверждение ВХОДА по билету в браузере — с человеком в цикле.
//
// Разбор 2026-08-31. Прежде вход по билету на путях OAuth/письма сервер
// подтверждал САМ, в своём callback: `approveLoginIfPossible(code, вошедший)`
// срабатывал молча, без единого нажатия. Это ровно та дыра, от которой
// защищает бот: там человек видит код и жмёт «это я». В браузере же билет
// одобрялся за того, кто прошёл вход, — а код в `?ticket=` мог подставить кто
// угодно (выписка билета анонимна, OptionalJwtGuard). Схема атаки — device-code
// phishing: злоумышленник выписывает билет у себя, заманивает жертву пройти
// обычный вход через Google по ссылке `/api/auth/google?ticket=<его код>`,
// сервер молча одобряет ЕГО билет личностью жертвы, и злоумышленник забирает
// сессию жертвы опросом. Комментарий в старом контроллере утверждал, что
// «OAuth подтверждает сервер в callback» — это и было неверное допущение.
//
// Чиним симметрично боту: браузерные пути больше не одобряют молча, а уводят
// уже вошедшего человека на экран сверки (`/auth/confirm`), где он ЯВНО
// подтверждает код своей сессией. Одобрить билет теперь можно только этим
// аутентифицированным действием — публичного «тихого» одобрения входа не
// осталось нигде.
import {
  Controller,
  HttpCode,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { LoginTicketService } from './login-ticket/login-ticket.service';
import { UserCodeDto } from './dto/login-ticket.dto';
import { requireCsrf } from './auth-http.util';
import { SecurityLogService } from './security-log.service';

@Controller('api/auth/ticket')
export class AuthLoginConfirmController {
  constructor(
    private readonly tickets: LoginTicketService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // «Да, это я»: одобрить вход в контейнер, начавший его у себя. Хозяином
  // становится сессия, которая жмёт кнопку, — не тот, кто выписал билет.
  @Post('confirm-login')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async confirmLogin(
    @Body() body: UserCodeDto,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    requireCsrf(req, 'ticket/confirm-login', this.securityLog);
    // approveLoginIfPossible, а не approveLogin: мёртвый/чужой код не должен
    // отдавать 400 в браузер — экран покажет «код не найден» по ok:false.
    const ok = await this.tickets.approveLoginIfPossible(
      body.code,
      req.webUser!.userId,
    );
    return { ok };
  }

  // «Это не я»: человек не начинал вход в приложении — гасим билет, чтобы
  // ждущий опросом контейнер получил отказ, а не завис до истечения.
  @Post('deny-login')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    long: { limit: 20, ttl: 3_600_000 },
  })
  @HttpCode(200)
  async denyLogin(
    @Body() body: UserCodeDto,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    requireCsrf(req, 'ticket/deny-login', this.securityLog);
    // Мёртвый код гасить нечего — deny бросит, Nest вернёт 400, а экран всё
    // равно покажет «доступ никто не получил». Живой билет гасится и ждущий
    // контейнер получает отказ. Молча тут ничего не глотаем.
    await this.tickets.deny(body.code);
    return { ok: true };
  }
}
