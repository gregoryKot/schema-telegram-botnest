import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { telegramOauthLoginUrl } from './telegram-oauth-url';

// Инцидент 2026-08-21: привязка домена к боту в BotFather слетела —
// oauth.telegram.org/auth стал отвечать голым текстом «Bot domain invalid».
// Вход через Telegram на сайте не работал ни у одного пользователя, и об
// этом узнали только от самого пользователя: привязка домена — внешняя
// настройка Telegram, её не видит ни один наш тест и ни один деплой-чек
// (правило №14 CLAUDE.md — «всё, что исполняется у пользователя, обязано
// быть кем-то проверено»). Этот сторожок раз в час дёргает тот же URL,
// который строит telegramRedirect, и следит за ответом.
//
// Алерт — только по ПЕРЕХОДУ состояния (здоров↔поломка) плюс суточное
// напоминание, пока поломка держится: часовой крон, шлющий DM на каждый
// прогон, за сутки даст 24 одинаковых сообщения и админ замьютит чат —
// тогда как раз во время аварии алертинг замолчит (тот же урок, что и
// SecurityLogService.alertAdmin про suspicious_initdata 2026-07-29).
const BROKEN_MARKERS = ['Bot domain invalid', 'Bot not found'];
const REMINDER_INTERVAL_MS = 24 * 3600_000;

@Injectable()
export class TelegramDomainWatchdogService {
  private readonly logger = new Logger(TelegramDomainWatchdogService.name);
  private broken = false;
  private lastAlertAt = 0;

  constructor(
    private readonly config: ConfigService,
    // Инжектируемые часы — по образцу SecurityLogService: тест суточного
    // напоминания обязан быть детерминированным, без реальных таймеров.
    @Optional() private readonly now: () => number = Date.now,
  ) {}

  @Cron('7 * * * *', { name: 'telegramDomainWatchdog' })
  async handleCron(): Promise<void> {
    await this.check();
  }

  async check(): Promise<void> {
    // Не getOrThrow: локальная среда и тесты без BOT_TOKEN/WEBAPP_URL не
    // обязаны падать и не обязаны ходить в сеть — это фоновый сторожок,
    // а не обязательный путь запроса.
    const botToken = this.config.get<string>('BOT_TOKEN')?.trim();
    const webappUrl = this.config.get<string>('WEBAPP_URL');
    if (!botToken || !webappUrl) return;
    const botId = botToken.split(':')[0];
    const frontendBase = webappUrl.replace(/\/$/, '');

    let text: string;
    try {
      const res = await fetch(telegramOauthLoginUrl(botId, frontendBase), {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        // HTTP-ошибка сама по себе не значит «домен отвязан» — может быть
        // временный сбой самого oauth.telegram.org. Не трогаем состояние.
        this.logger.warn(
          `telegram domain watchdog: HTTP ${res.status} от oauth.telegram.org`,
        );
        return;
      }
      text = await res.text();
    } catch (err) {
      // Сеть/таймаут — тот же принцип: неизвестность не равна поломке.
      this.logger.warn(
        `telegram domain watchdog: запрос не удался: ${(err as Error).message}`,
      );
      return;
    }

    const marker = BROKEN_MARKERS.find((m) => text.includes(m));
    if (marker) {
      await this.onBroken(marker, frontendBase);
    } else if (this.broken) {
      await this.onRecovered();
    }
  }

  private async onBroken(marker: string, frontendBase: string): Promise<void> {
    const wasBroken = this.broken;
    this.broken = true;
    const nowMs = this.now();
    if (wasBroken && nowMs - this.lastAlertAt < REMINDER_INTERVAL_MS) return;
    this.lastAlertAt = nowMs;
    await notifyAdminWithFallback(
      `⚠️ Вход через Telegram на сайте не работает: oauth.telegram.org отвечает «${marker}» для ${frontendBase}. Домен отвязался от бота. Починить: в @BotFather — /setdomain, выбрать бота, отправить домен сайта.`,
      '⚠️ Вход через Telegram сломан',
    ).catch((err) =>
      this.logger.warn(
        `не удалось отправить DM админу про поломку telegram-домена: ${(err as Error)?.message}`,
      ),
    );
  }

  private async onRecovered(): Promise<void> {
    this.broken = false;
    this.lastAlertAt = this.now();
    await notifyAdminWithFallback(
      '✅ Вход через Telegram на сайте снова работает: oauth.telegram.org отдаёт страницу входа.',
      '✅ Вход через Telegram починился',
    ).catch((err) =>
      this.logger.warn(
        `не удалось отправить DM админу про восстановление telegram-домена: ${(err as Error)?.message}`,
      ),
    );
  }
}
