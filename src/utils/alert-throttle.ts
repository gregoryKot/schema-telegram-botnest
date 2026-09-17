// Троттлинг однотипных алертов админу — общий примитив. Вынесен из
// src/api/initdata-alert.ts, чтобы жить у ДОСТАВКИ (SecurityLogService),
// а не размножаться по каждому вызывающему, который может забыть его
// применить (см. заголовок security-log.service.ts).
//
// Инцидент 2026-07-29: Telegram шлёт устаревшую initData каждым запросом
// свёрнутого мини-аппа — шквал одинаковых DM `suspicious_initdata` замьютил
// админский чат, и в шквале потонула бы настоящая подделка подписи. Отсюда
// AlertThrottle: один слот на ключ за окно, остальное копится счётчиком.
//
// Но единственный слот на окно — неверная модель для РЕДКИХ событий:
// `merge_confirmed`, `role_changed`, `therapist_request_submitted` — каждое
// само по себе важно, и два разных пользователя, слившие аккаунты с разницей
// в 5 минут, обязаны дать ДВА DM, а не один. AlertBudget — вторая половина
// того же примитива: бюджет K алертов на ключ за окно, а не единственный
// слот. Редкие события (меньше K в окне) доставляются все; шквал
// схлопывается ровно в K DM, дальше глушится счётчиком, который сообщает
// о себе в первом алерте следующего окна.

export interface AlertDecision {
  allow: boolean;
  suppressed: number;
}

/**
 * Троттлинг однотипных алертов по ключу (у нас — IP/площадка). Первый случай
 * в окне доходит сразу, остальные копятся счётчиком и приезжают числом в
 * следующем алерте.
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

  take(key: string, now: number = Date.now()): AlertDecision {
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

/**
 * Бюджет K алертов на ключ за окно — вместо единственного слота. Первые K
 * попаданий в окне доставляются КАЖДОЕ (редкие события никогда не упираются
 * в потолок), (K+1)-е и далее глушатся счётчиком. Первый допущенный алерт
 * СЛЕДУЮЩЕГО окна сообщает, сколько проглотили — а не молчит об этом
 * навсегда. Разные ключи (разные события/площадки) бюджет не делят.
 */
export class AlertBudget {
  private readonly windows = new Map<
    string,
    { windowStart: number; count: number; suppressed: number }
  >();

  constructor(
    private readonly windowMs: number,
    private readonly maxPerWindow: number,
    private readonly maxKeys = 500,
  ) {}

  take(key: string, now: number = Date.now()): AlertDecision {
    const entry = this.windows.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      // Новое окно — бюджет обнулился. Переносим счётчик подавленных из
      // ПРЕДЫДУЩЕГО окна, чтобы шквал не потерялся бесследно.
      const carried = entry?.suppressed ?? 0;
      this.windows.set(key, { windowStart: now, count: 1, suppressed: 0 });
      this.prune(now, key);
      return { allow: true, suppressed: carried };
    }
    if (entry.count < this.maxPerWindow) {
      entry.count += 1;
      return { allow: true, suppressed: 0 };
    }
    entry.suppressed += 1;
    return { allow: false, suppressed: entry.suppressed };
  }

  private prune(now: number, keep: string): void {
    for (const [k, v] of this.windows) {
      if (k !== keep && now - v.windowStart >= this.windowMs * 2)
        this.windows.delete(k);
    }
    if (this.windows.size > this.maxKeys) this.windows.clear();
  }
}
