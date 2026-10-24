import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClientErrorDto } from './dto/client-error.dto';
import { buildClientErrorDetail } from './client-error-detail';
import { ClientErrorLogGate } from './client-error-log-gate';
import { AnalyticsService } from '../analytics/analytics.service';
import { classifyClientErrorSection } from './client-error-section';

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
// первого аргумента»). Теперь отчёт ещё и СЧИТАЕТСЯ — событие
// 'client_error' в AnalyticsEvent (userId = null, тот же приём, что у
// auth_rejected/auth_success), видно в /stats. meta — source, канонический
// бакет section и числа suppressed/unlogged (правило №7: свободного текста нет).
// Лог и счётчик решает ОДИН вердикт ClientErrorLogGate (client-error-log-gate.ts):
// подробный detail пишется раз в 5 мин на `source|section|ip` и не чаще общего
// бюджета в минуту, остальное только считается — шквал не вытесняет логи аварии.
// Один сломанный экран шлёт отчёт при КАЖДОМ ремаунте, считать нужно вспышки.

@Controller('api')
export class ClientErrorsController {
  private readonly logger = new Logger('ClientError');
  private readonly gate = new ClientErrorLogGate();

  constructor(private readonly analytics: AnalyticsService) {}

  @Post('client-errors')
  @HttpCode(204)
  report(@Body() body: ClientErrorDto, @Req() req: Request): void {
    // body.source (enum DTO) и section (канонический бакет из allow-list
    // classifyClientErrorSection, НЕ свободный текст body.section) —
    // единственное влияние клиента на первый аргумент, и оба из белого
    // списка (инвариант H0/H6 выше не нарушен): DM сразу отличает «упал вход»
    // от «упал дневник».
    const section = classifyClientErrorSection(body.section);
    const verdict = this.gate.take(
      `${body.source}|${section}|${req.ip ?? 'no-ip'}`,
    );
    if (verdict.kind === 'repeat') return;
    const { repeats } = verdict;
    if (verdict.kind === 'full') {
      this.logger.error(
        `[client:${body.source}/${section}] ошибка фронтенда (детали в логах)`,
        buildClientErrorDetail(body, repeats),
      );
    }
    void this.analytics.track(null, 'client_error', {
      source: body.source,
      section,
      ...(repeats > 0 && { suppressed: repeats }),
      ...(verdict.kind === 'unlogged' && { unlogged: true }),
    });
  }
}
