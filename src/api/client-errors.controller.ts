import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ClientErrorDto } from './dto/client-error.dto';
import { stripUrlSecrets } from './telemetry-url.util';

// Приём ошибок фронтендов (best-practice «видимость прода», 2026-07).
// БЕЗ auth-гарда: краш возможен и до/во время авторизации, тогда токена нет.
// Идентичность не нужна — это телеметрия, не пользовательские данные.
//
// Защита от спама (правило №5 + существующая инфраструктура):
//   • глобальный UserThrottlerGuard бакетит неверифицированные запросы по IP
//     (10/сек, 200/мин) — ротацией фейкового sub лимит не обойти;
//   • AlertLogger дополнительно троттлит DM: одинаковый (нормализованный по
//     цифрам) текст уходит админу не чаще раза в 60с.
//
// ─── Инвариант после аудита 2026-07-20 (H0/H6) ─────────────────────────────
// AlertLogger шлёт админу в Telegram ТОЛЬКО первый аргумент `.error()`
// (optionalParams идут лишь в stdout). Поэтому:
//   1. первый аргумент постоянен и не содержит НИЧЕГО клиентского — иначе
//      (H0) живой креденшел из фрагмента URL (initData с подписью, JWT) уезжал
//      в логи и в личку админа, а (H6) аноним доставлял туда произвольный текст
//      и, варьируя буквы, обходил троттл 60с (тот нормализует только цифры);
//   2. детали и стек — вторым аргументом, URL — через `stripUrlSecrets`.
// Размен: в DM больше нет текста ошибки, админ идёт за деталями в логи.
// Подробности и PoC — docs/SECOND_AUDIT.md, регрессии — в .spec рядом.
@Controller('api')
export class ClientErrorsController {
  private readonly logger = new Logger('ClientError');

  @Post('client-errors')
  @HttpCode(204)
  report(@Body() body: ClientErrorDto): void {
    const safeUrl = stripUrlSecrets(body.url);
    const detail = [
      `${body.section}: ${body.message}`,
      safeUrl ? `url=${safeUrl}` : null,
      body.stack ?? body.componentStack ?? null,
    ]
      .filter(Boolean)
      .join('\n');

    // body.source валидируется DTO как enum ('webapp' | 'miniapp') —
    // единственное влияние клиента на первый аргумент, и оно из белого списка.
    this.logger.error(
      `[client:${body.source}] ошибка фронтенда (детали в логах)`,
      detail,
    );
  }
}
