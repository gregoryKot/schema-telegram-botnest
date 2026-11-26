// Счётчик неверных кодов 2FA на ЗАЩИЩАЕМЫЙ аккаунт (S11, аудит 2026-11).
//
// Лимиты ручек (CODE_THROTTLE) считают по IP или по вызывающему: анонимный
// `2fa/challenge` бакетится по адресу, merge — по атакующему, и смена адреса
// давала свежие 20 попыток в час на один и тот же аккаунт. Здесь ключ — сам
// аккаунт (`totp-fail:<userId>`), счётчик живёт в Postgres (ThrottleHit через
// PostgresThrottleStorage — тот же атомарный INSERT … ON CONFLICT, доказанный
// на живой базе в test/throttle-storage.e2e-spec.ts) и общий для всех путей,
// потому что проверка стоит в одном месте — TotpService.verifyCode.
//
// Решения:
// - 10 неверных кодов за окно 24 ч → коды из приложения не принимаются до
//   конца окна (429 `totp_locked`). Резервный код принимается и на паузе:
//   40 бит не перебрать, а владелец не заперт на сутки атакующим.
// - Верный код счётчик НЕ обнуляет: «не больше 10 промахов в сутки на
//   аккаунт» — инвариант без исключений, и вход владельца не возвращает
//   подбирающему его бюджет. Опечатки владельца в него укладываются.
// - Уведомление владельцу — ровно одно на окно: его шлёт тот запрос, чей
//   атомарный инкремент вернул ровно 10.
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostgresThrottleStorage } from '../api/postgres-throttle-storage';
import { SecurityLogService } from './security-log.service';
import { SecurityNoticeService } from './security-notice.service';

export const TOTP_FAIL_LIMIT = 10;
export const TOTP_FAIL_WINDOW_MS = 24 * 3600_000;
export const TOTP_LOCKED_REASON = 'totp_locked';

export const totpFailKey = (userId: bigint): string => `totp-fail:${userId}`;

export class TotpLockedException extends HttpException {
  constructor(retryAfterS: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message:
          'Слишком много неверных кодов — ввод кода на паузе, резервный код работает',
        reason: TOTP_LOCKED_REASON,
        retryAfter: retryAfterS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class TotpAttemptsService {
  private readonly logger = new Logger(TotpAttemptsService.name);
  private readonly storage: PostgresThrottleStorage;

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityLog: SecurityLogService,
    private readonly notice: SecurityNoticeService,
  ) {
    this.storage = new PostgresThrottleStorage(prisma);
  }

  /** Сколько секунд аккаунт ещё на паузе; 0 — коды принимаются. */
  async lockedFor(userId: bigint, now = new Date()): Promise<number> {
    const row = await this.prisma.throttleHit.findUnique({
      where: { key: totpFailKey(userId) },
    });
    if (!row) return 0;
    let until: Date | null = null;
    if (row.blockedUntil && row.blockedUntil > now) until = row.blockedUntil;
    else if (row.expiresAt > now && row.hits >= TOTP_FAIL_LIMIT)
      until = row.expiresAt;
    return until ? Math.ceil((until.getTime() - now.getTime()) / 1000) : 0;
  }

  /** Неверный код: +1 к окну аккаунта; десятый — пауза и одно уведомление. */
  async recordFailure(userId: bigint): Promise<void> {
    let hits: number;
    try {
      const rec = await this.storage.increment(
        totpFailKey(userId),
        TOTP_FAIL_WINDOW_MS,
        TOTP_FAIL_LIMIT,
        TOTP_FAIL_WINDOW_MS,
      );
      hits = rec.totalHits;
    } catch (err) {
      // Отказ уже случился (код неверный) — счётчик недоступен вместе с БД;
      // warn, не error: авария БД алертится отдельно.
      this.logger.warn(
        `счётчик неудач 2FA недоступен (${userId}): ${(err as Error).message}`,
      );
      return;
    }
    if (hits !== TOTP_FAIL_LIMIT) return;
    this.securityLog.log('totp_locked', { userId });
    this.notice.notify(userId, { kind: 'totp_locked' });
  }
}
