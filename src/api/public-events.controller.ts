import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from '../analytics/analytics.service';
import type { PublicAnalyticsEventName } from '../analytics/analytics.constants';
import { PRACTICE_LINK_PLACES } from '../analytics/analytics.constants';
import {
  isGameEvent,
  sanitizeGameMeta,
} from '../analytics/game-events.constants';
import { PublicEventDto } from './dto/public-event.dto';
import { sanitizePublicCrisisMeta } from './public-crisis.sanitize';
import { isQuizId, quizResultIdSet } from '../quiz/quiz-registry';

// Анонимному лендингу (правило №5/№14) — ТОЛЬКО 'add'/'added', их шлёт
// AppInstallSection.tsx. 'shown'/'later'/'never' — состояния воронки, аноним
// не обязан быть честным. Расширять — сознательное решение, не копия auth-пути.
const PUBLIC_HOME_SCREEN_ACTIONS: ReadonlySet<string> = new Set([
  'add',
  'added',
]);

// Анонимная аналитика (правило №8): мини-тест, клик на сайт практики, блок
// установки, игра (game/, правило №5/№14), кризисная карточка записи — событие
// пишется с userId = null. Идентичность не верифицирована: бакет по IP, лимит жёстче.
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
   * Пропускает ТОЛЬКО известные поля по реестрам (игра — своим санитайзером;
   * тесты/клики/значок — src клиенту не доверяем, эндпоинт пишет 'web' сам).
   */
  private sanitize(
    name: PublicAnalyticsEventName,
    meta: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    if (isGameEvent(name)) return sanitizeGameMeta(name, meta);
    if (name === 'practice_link_click') {
      const place = meta?.place;
      return typeof place === 'string' && this.validPlaces.has(place)
        ? { place }
        : null;
    }
    if (name === 'crisis_card_shown' || name === 'crisis_hotline_tapped') {
      return sanitizePublicCrisisMeta(meta);
    }
    if (name === 'home_screen_offer') {
      const action = meta?.action;
      const surface = meta?.surface;
      // Публичный путь принимает ТОЛЬКО лендинг (site_landing): остальные
      // поверхности авторизованы — POST /api/event (HOME_SCREEN_SURFACE_SET).
      return typeof action === 'string' &&
        PUBLIC_HOME_SCREEN_ACTIONS.has(action) &&
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
