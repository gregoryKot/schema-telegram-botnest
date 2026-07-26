import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from '../analytics/analytics.service';
import type { PublicAnalyticsEventName } from '../analytics/analytics.constants';
import { PublicEventDto } from './dto/public-event.dto';
import { isQuizId, quizResultIdSet } from '../quiz/quiz-registry';

// Анонимная аналитика мини-тестов с публичного сайта (правило №8): гость без
// регистрации проходит тест — событие пишется с userId = null. Идентичность
// не верифицирована, поэтому троттлинг-бакет — по IP (правило №5: глобальный
// UserThrottlerGuard для запросов без кредов возвращает именно IP), и лимит
// заметно жёстче обычного: пара тестов в минуту, а не поток.
@Controller('api')
export class PublicEventsController {
  private readonly validResults = quizResultIdSet();

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
   * Пропускает ТОЛЬКО известные поля по реестру тестов; src клиенту не
   * доверяем — публичный эндпоинт всегда пишет 'web' (бот шлёт 'bot' сам,
   * через AnalyticsService напрямую).
   */
  private sanitize(
    name: PublicAnalyticsEventName,
    meta: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
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
