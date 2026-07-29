// Классификация отказов initData + защита админского чата от шквала алертов.
//
// Инцидент 2026-07-29: Telegram выдаёт initData ОДИН раз — в момент открытия
// мини-аппа — и не обновляет её, пока webview жив. Свернул приложение, открыл
// через час: та же строка, `auth_date` старше часа, каждый запрос ловит 401.
// Экран мини-аппа шлёт полтора десятка запросов, и каждый уходил админу
// отдельным DM «🚨 suspicious_initdata». Истёкшая сессия — обычный жизненный
// цикл, а не атака: будить ею админа нельзя, и главное — в этом потоке тонет
// настоящая подделка подписи, ради которой алерт и заводился.
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ExpiredError } from '@tma.js/init-data-node';
import { SecurityLogService } from '../auth/security-log.service';

export type InitDataFailureKind = 'expired' | 'suspicious';

/** Код в теле 401 — по нему мини-апп понимает, что сессию надо перевыпустить. */
export const INITDATA_EXPIRED_CODE = 'initdata_expired';

export function classifyInitDataFailure(err: unknown): InitDataFailureKind {
  if (err instanceof ExpiredError) return 'expired';
  // Подстраховка: error-kid-классы теряют instanceof, если пакет продублирован
  // (ESM/CJS-копии в дереве зависимостей) — тогда смотрим на текст ошибки.
  const msg = err instanceof Error ? err.message : String(err);
  return /^init data expired/i.test(msg) ? 'expired' : 'suspicious';
}

/**
 * Троттлинг однотипных алертов по ключу (у нас — IP). Настоящая атака тоже
 * приходит пачкой (скрипт перебирает подписи), а сотня DM подряд = замьюченный
 * чат, то есть ноль алертов. Первый случай в окне доходит сразу, остальные
 * копятся счётчиком и приезжают числом в следующем алерте.
 */
export class AlertThrottle {
  private readonly seen = new Map<
    string,
    { firstAt: number; suppressed: number }
  >();

  constructor(
    private readonly windowMs: number,
    private readonly maxKeys = 500,
  ) {}

  take(
    key: string,
    now: number = Date.now(),
  ): { allow: boolean; suppressed: number } {
    const entry = this.seen.get(key);
    if (entry && now - entry.firstAt < this.windowMs) {
      entry.suppressed += 1;
      return { allow: false, suppressed: entry.suppressed };
    }
    // Окно закрылось — пропускаем алерт и сообщаем, сколько попыток проглотили.
    const suppressed = entry?.suppressed ?? 0;
    this.seen.set(key, { firstAt: now, suppressed: 0 });
    this.prune(now, key);
    return { allow: true, suppressed };
  }

  private prune(now: number, keep: string): void {
    // Держим запись ещё одно окно после закрытия — иначе счётчик подавленных
    // потеряется до того, как о нём успеет сообщить следующий алерт.
    for (const [k, v] of this.seen) {
      if (k !== keep && now - v.firstAt >= this.windowMs * 2)
        this.seen.delete(k);
    }
    // Аварийный потолок: распределённый перебор с тысяч IP не должен съесть память.
    if (this.seen.size > this.maxKeys) this.seen.clear();
  }
}

export const initDataAlerts = new AlertThrottle(10 * 60_000);

/** Всегда бросает 401; различает истёкшую сессию и попытку подделки. */
export function rejectInitData(
  err: unknown,
  ip: string | undefined,
  logger: Logger,
  securityLog: SecurityLogService,
): never {
  const reason = (err as Error).message;
  // Истёкшая initData — не атака, а жизненный цикл мини-аппа (см. шапку файла).
  // Мини-апп чинит это сам: по коду ниже он перевыпускает сессию.
  if (classifyInitDataFailure(err) === 'expired') {
    throw new UnauthorizedException({
      code: INITDATA_EXPIRED_CODE,
      message: 'Telegram init data expired',
    });
  }
  logger.warn(`initData invalid: ${reason}`);
  // Подделка подписи — либо реальная атака, либо недокатившаяся ротация
  // BOT_TOKEN; админ обязан это увидеть.
  const { allow, suppressed } = initDataAlerts.take(ip ?? '?');
  if (allow) {
    securityLog.log('suspicious_initdata', {
      reason,
      ip,
      ...(suppressed > 0 ? { suppressed } : {}),
    });
  }
  throw new UnauthorizedException('Invalid initData');
}
