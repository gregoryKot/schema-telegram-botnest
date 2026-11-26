import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClientErrorDto } from './dto/client-error.dto';
import { buildClientErrorDetail } from './client-error-detail';
import { ClientErrorLogGate } from './client-error-log-gate';
import { ClientErrorDigest } from './client-errors-digest';
import { AnalyticsService } from '../analytics/analytics.service';
import { classifyClientErrorSection } from './client-error-section';

// Приём ошибок фронтендов (best-practice «видимость прода», 2026-07).
// БЕЗ auth-гарда: краш возможен и до/во время авторизации, тогда токена нет.
// Идентичность не нужна — это телеметрия, не пользовательские данные.
// Спам: глобальный UserThrottlerGuard бакетит неверифицированные запросы по IP
// (10/сек, 200/мин) — ротацией фейкового sub лимит не обойти (правило №5).
//
// ─── Уровень warn и сводка (аудит 2026-11, S13) ────────────────────────────
// Раньше отчёт шёл logger.error → AlertLogger → DM владельцу, и аноним с
// нескольких IP выжигал общий бюджет DM: настоящие ошибки сервера уходили в
// «подавлено ещё N». Теперь отчёт — warn (только лог), а владельцу раз в час
// приходит сводка: сколько отчётов и какие разделы (client-errors-digest.ts).
//
// ─── Инвариант после аудита 2026-07-20 (H0/H6) ─────────────────────────────
// Первый аргумент лога постоянен и не содержит НИЧЕГО клиентского: (H0) живой
// креденшел из фрагмента URL (initData с подписью, JWT) уезжал в логи и в
// личку админа, (H6) аноним доставлял туда произвольный текст. Детали и стек —
// вторым аргументом, URL — через `stripUrlSecrets`. PoC — docs/SECOND_AUDIT.md.
//
// ─── Волна 9 щита покрытия (docs/SHIELD_PROMPT.md) ─────────────────────────
// Отчёт ещё и СЧИТАЕТСЯ — событие 'client_error' в AnalyticsEvent (userId =
// null), видно в /stats. meta — source, бакет section и числа
// suppressed/unlogged (правило №7: свободного текста нет). Лог и счётчик
// решает ОДИН вердикт ClientErrorLogGate (client-error-log-gate.ts): detail
// пишется раз в 5 мин на `source|section|ip` и не чаще общего бюджета в
// минуту — шквал не вытесняет логи аварии. Сводка считает каждый отчёт.

@Controller('api')
export class ClientErrorsController {
  private readonly logger = new Logger('ClientError');
  private readonly gate = new ClientErrorLogGate();
  private readonly digest = new ClientErrorDigest();

  constructor(private readonly analytics: AnalyticsService) {}

  @Post('client-errors')
  @HttpCode(204)
  report(@Body() body: ClientErrorDto, @Req() req: Request): void {
    // body.source (enum DTO) и section (канонический бакет из allow-list
    // classifyClientErrorSection, НЕ свободный текст body.section) —
    // единственное влияние клиента на первый аргумент, и оба из белого
    // списка (инвариант H0/H6 выше не нарушен): лог сразу отличает «упал вход»
    // от «упал дневник».
    const section = classifyClientErrorSection(body.section);
    this.digest.note(section);
    const verdict = this.gate.take(
      `${body.source}|${section}|${req.ip ?? 'no-ip'}`,
    );
    if (verdict.kind === 'repeat') return;
    const { repeats } = verdict;
    if (verdict.kind === 'full') {
      this.logger.warn(
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
