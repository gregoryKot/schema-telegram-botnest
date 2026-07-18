import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ClientErrorDto } from './dto/client-error.dto';

// Приём ошибок фронтендов (best-practice «видимость прода», 2026-07).
// БЕЗ auth-гарда: краш возможен и до/во время авторизации, тогда токена нет.
// Идентичность не нужна — это телеметрия, не пользовательские данные.
//
// Защита от спама (правило №5 + существующая инфраструктура):
//   • глобальный UserThrottlerGuard бакетит неверифицированные запросы по IP
//     (10/сек, 200/мин) — ротацией фейкового sub лимит не обойти;
//   • AlertLogger дополнительно троттлит DM: одинаковый (нормализованный по
//     цифрам) текст уходит админу не чаще раза в 60с. Лавина одинаковых
//     крашей = один DM, а не тысяча.
@Controller('api')
export class ClientErrorsController {
  private readonly logger = new Logger('ClientError');

  @Post('client-errors')
  @HttpCode(204)
  report(@Body() body: ClientErrorDto): void {
    // .error() маршрутизируется в AlertLogger (глобальный логгер, main.ts) →
    // DM админу с fallback на e-mail. Fire-and-forget, ответ мгновенный.
    const where = body.url ? ` @ ${body.url}` : '';
    this.logger.error(
      `[client:${body.source}] ${body.section}: ${body.message}${where}`,
      body.stack ?? body.componentStack,
    );
  }
}
