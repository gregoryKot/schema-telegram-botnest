import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from '../analytics/analytics.service';
import type { PublicAnalyticsEventName } from '../analytics/analytics.constants';
import { PRACTICE_LINK_PLACES } from '../analytics/analytics.constants';
import { PublicEventDto } from './dto/public-event.dto';
import { HOME_SCREEN_ACTION_SET } from './dto/analytics.dto';
import { isQuizId, quizResultIdSet } from '../quiz/quiz-registry';

// Анонимная аналитика публичного сайта (правило №8): гость без регистрации
// проходит мини-тест, кликает ссылку на сайт практики с лендинга или видит
// блок установки на экран (site_landing) — событие пишется с userId = null.
// Идентичность не верифицирована, поэтому троттлинг-бакет — по IP (правило
// №5: глобальный UserThrottlerGuard для запросов без кредов возвращает
// именно IP), и лимит заметно жёстче обычного.
@Controller('api')
export class PublicEventsController {
  private readonly validResults = quizResultIdSet();
  private readonly validPlaces: ReadonlySet<string> = new Set(
    PRACTICE_LINK_PLACES,
  );

  constructor(private readonly analytics: AnalyticsService) {}

  @Post('public-event')
  @Throttle({
    short: { limit: 5, ttl: 1_000 },
    long: { limit: 30, ttl: 60_000 },
  })
  async track(@Body() body: PublicEventDto): Promise<{ ok: true }> {
    const meta = this.sanitize(
      body.name as PublicAnalyticsEventName,
      body.meta,
    );
    // Невалидная meta — молча дропаем (аналитика никогда не ломает UX и не
    // служит оракулом для перебора), валидная — пишем анонимно.
    if (meta) {
      await this.analytics.track(
        null,
        body.name as PublicAnalyticsEventName,
        meta,
      );
    }
    return { ok: true };
  }

  /**
   * Пропускает ТОЛЬКО известные поля по реестрам (тесты, места клика,
   * предложение значка на экран с лендинга); src клиенту не доверяем —
   * публичный эндпоинт всегда пишет 'web' (бот шлёт 'bot' сам, через
   * AnalyticsService напрямую).
   */
  private sanitize(
    name: PublicAnalyticsEventName,
    meta: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    if (name === 'practice_link_click') {
      const place = meta?.place;
      return typeof place === 'string' && this.validPlaces.has(place)
        ? { place }
        : null;
    }
    if (name === 'home_screen_offer') {
      const action = meta?.action;
      const surface = meta?.surface;
      // Публичный путь принимает ТОЛЬКО лендинг (site_landing) — остальные
      // поверхности (в т.ч. site_banner в кабинете) авторизованы и идут
      // через POST /api/event, там своя валидация по HOME_SCREEN_SURFACE_SET.
      return typeof action === 'string' &&
        HOME_SCREEN_ACTION_SET.has(action) &&
        surface === 'site_landing'
        ? { action, surface }
        : null;
    }
    const quiz = meta?.quiz;
    if (typeof quiz !== 'string' || !isQuizId(quiz)) return null;
    if (name === 'quiz_started') return { quiz, src: 'web' };
    const result = meta?.result;
    if (
      typeof result !== 'string' ||
      !this.validResults.has(`${quiz}:${result}`)
    ) {
      return null;
    }
    return { quiz, result, src: 'web' };
  }
}
