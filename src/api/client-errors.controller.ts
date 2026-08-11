import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClientErrorDto } from './dto/client-error.dto';
import { stripUrlSecrets } from './telemetry-url.util';
import { AnalyticsService } from '../analytics/analytics.service';
import { classifyClientErrorSection } from './client-error-section';
import { AlertThrottle } from '../utils/alert-throttle';

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
//
// ─── Волна 9 щита покрытия (docs/SHIELD_PROMPT.md) ─────────────────────────
// До этой волны логировался только текст (в логах хостинга — де-факто
// невидим, «AlertLogger сжимает разные ошибки в один DM за счёт постоянного
// первого аргумента»). Теперь КАЖДЫЙ отчёт также СЧИТАЕТСЯ — событие
// 'client_error' в AnalyticsEvent (userId = null, тот же приём, что у
// auth_rejected/auth_success), видно в /stats. meta — только source +
// канонический бакет section (правило №7: никакого свободного текста).
// Троттлинг счётчика — ОТДЕЛЬНЫЙ от троттлинга лога: один сломанный экран
// шлёт отчёт при КАЖДОМ ремаунте (ErrorBoundary может ловить один и тот же
// краш десятки раз за минуту), а считать нужно вспышки, а не запросы.
// 5 минут — то же окно, что у EVENT_THROTTLE в auth-failure.report.ts,
// умышленно: блок /stats считает оба счётчика в сопоставимых окнах.
const REPORT_THROTTLE = new AlertThrottle(5 * 60_000);

@Controller('api')
export class ClientErrorsController {
  private readonly logger = new Logger('ClientError');

  constructor(private readonly analytics: AnalyticsService) {}

  @Post('client-errors')
  @HttpCode(204)
  report(@Body() body: ClientErrorDto, @Req() req: Request): void {
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
    // Лог НЕ троттлится здесь — это отдельный, уже существующий канал
    // (AlertLogger троттлит DM сам, по нормализованному тексту).
    this.logger.error(
      `[client:${body.source}] ошибка фронтенда (детали в логах)`,
      detail,
    );

    const section = classifyClientErrorSection(body.section);
    const key = `${body.source}|${section}|${req.ip ?? 'no-ip'}`;
    if (REPORT_THROTTLE.take(key).allow) {
      void this.analytics.track(null, 'client_error', {
        source: body.source,
        section,
      });
    }
  }
}
