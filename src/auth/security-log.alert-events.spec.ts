// security-log.service.ts — состав ALERT_EVENTS, окно DM-бюджета, имя логгера
// и видимость недоставленного DM. Модуль грузится СВЕЖИМ внутри каждого теста
// (jest.isolateModules), как crypto.spec.ts.
//
// Зачем отдельный файл, а не ещё один describe в security-log.service.spec.ts.
// Всё, что проверяется ниже, — код уровня модуля (`new Set([...])`, константа
// окна, `new Logger('…')`). Когда сервис импортируется на верхушке спека, этот
// код исполняется ДО первого теста, и мутационный прогон (Stryker,
// coverageAnalysis: perTest + ignoreStatic) такие мутанты не пробует вовсе. Но
// стоило другому спеку (data-export.service.spec.ts, PR #605) загрузить тот же
// модуль лениво, внутри теста, — как мутанты стали «гибридными»: их пробуют
// только против тестов того спека, которые про DM ничего не утверждают.
// Результат (nightly 2026-10-14): `''` на месте любого события в ALERT_EVENTS
// выживал — то есть исчезновение, скажем, `csrf_blocked` из списка алертов
// не заметил бы ни один тест, а счёт файла упал с 95,74% до 65,71%.
//
// Лекарство — не исключение в конфиге, а тест, исполняющий этот код внутри
// собственного тела: теперь у мутантов есть покрывающие тесты, которые умеют
// падать. Каждое событие списка проверяется ПО ОТДЕЛЬНОСТИ и в обе стороны
// (алертные доходят, остальные молчат) — один общий «хоть что-то дошло» не
// различит, какое именно имя пропало.
import type { SecurityEvent } from './security-log.service';

const mockNotify = jest.fn().mockResolvedValue(undefined);

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: (...args: unknown[]) => mockNotify(...args),
}));

type ServiceModule = typeof import('./security-log.service');
type NestLogger = typeof import('@nestjs/common').Logger;

const flush = () => new Promise((r) => setImmediate(r));

/** Свежая копия сервиса + Logger из ТОГО ЖЕ изолированного реестра: у другого
 *  реестра другой класс, и спай на нём ничего бы не увидел. */
function load(now?: () => number): {
  service: InstanceType<ServiceModule['SecurityLogService']>;
  Logger: NestLogger;
} {
  let result:
    | {
        service: InstanceType<ServiceModule['SecurityLogService']>;
        Logger: NestLogger;
      }
    | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./security-log.service') as ServiceModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nest = require('@nestjs/common') as typeof import('@nestjs/common');
    result = { service: new mod.SecurityLogService(now), Logger: nest.Logger };
  });
  return result!;
}

beforeEach(() => {
  mockNotify.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Источник правды — тип SecurityEvent: все его значения перечислены ниже и
// разложены по двум корзинам. Событие, добавленное в тип без строки здесь,
// ломает компиляцию (Record требует все ключи), а не молча остаётся
// непроверенным.
const DM: Record<SecurityEvent, boolean> = {
  merge_confirmed: true,
  merge_subscription_conflict: true,
  role_changed: true,
  therapist_request_submitted: true,
  csrf_blocked: true,
  suspicious_initdata: true,
  empty_signature: true,
  refresh_token_reuse: true,
  login_success: false,
  login_failed: false,
  merge_initiated: false,
  provider_linked: false,
  provider_unlinked: false,
  data_exported: false,
  therapist_request_decided: false,
  rate_limited: false,
  login_ticket_denied: false,
  login_ticket_cross_user: false,
  totp_failed: false,
  admin_key_rejected: false,
  account_deleted: false,
  email_link_conflict: false,
};

const alerting = Object.entries(DM).filter(([, dm]) => dm);
const quiet = Object.entries(DM).filter(([, dm]) => !dm);

describe('SecurityLogService — какие события уходят админу в DM', () => {
  it.each(alerting)('%s — доходит до админа', async (event) => {
    const { service, Logger } = load(() => 0);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    service.log(event as SecurityEvent, { endpoint: 'x' });
    await flush();
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify.mock.calls[0][1]).toBe(`🔐 Security: ${event}`);
  });

  it.each(quiet)('%s — только в лог, админу тишина', async (event) => {
    const { service, Logger } = load(() => 0);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    service.log(event as SecurityEvent, { endpoint: 'x' });
    await flush();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`[${event}]`));
  });
});

describe('SecurityLogService — окно DM-бюджета', () => {
  const K = 3; // ALERT_BUDGET_MAX_PER_WINDOW
  const WINDOW_MS = 15 * 60_000;

  it('шквал в пределах окна: ровно K DM, остальные подавлены (окно — минуты, а не доли миллисекунды)', async () => {
    let now = 0;
    const { service, Logger } = load(() => now);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    // 20 событий, каждое на 30 секунд позже предыдущего: все внутри окна.
    for (let i = 0; i < 20; i++) {
      now = i * 30_000;
      service.log('csrf_blocked', { endpoint: 'refresh' });
    }
    await flush();
    // Не просто счётчик: дошли именно K DM про это событие.
    expect(mockNotify.mock.calls.map((c) => c[1])).toEqual(
      Array(K).fill('🔐 Security: csrf_blocked'),
    );
  });

  it('событие через полное окно после первого снова допускается', async () => {
    let now = 0;
    const { service, Logger } = load(() => now);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    for (let i = 0; i < K + 2; i++) {
      now = i * 10;
      service.log('csrf_blocked', { endpoint: 'refresh' });
    }
    now = WINDOW_MS + 1_000;
    service.log('csrf_blocked', { endpoint: 'refresh' });
    await flush();
    expect(mockNotify.mock.calls.map((c) => c[1])).toEqual(
      Array(K + 1).fill('🔐 Security: csrf_blocked'),
    );
  });
});

describe('SecurityLogService — логгер и недоставленный DM', () => {
  it('пишет под именем контекста SecurityAudit (по нему фильтруют журнал)', () => {
    const { service, Logger } = load(() => 0);
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    service.log('login_success', { userId: 1 });
    const logger = logSpy.mock.contexts[0] as { context?: string };
    expect(logger.context).toBe('SecurityAudit');
  });

  // `(err as Error)?.message` — не украшение: Promise может отклониться не
  // Error-ом, а `undefined`/строкой. Без `?.` обработчик ошибки сам бросил бы
  // TypeError внутри .catch → необработанный reject, а в логе — ни слова о том,
  // что DM не дошёл (тот самый класс «обработанная авария невидимее»).
  it('DM отклонён значением undefined — недоставка всё равно попадает в лог, без второго падения', async () => {
    const { service, Logger } = load(() => 0);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockNotify.mockRejectedValueOnce(undefined);
    service.log('csrf_blocked', { endpoint: 'x' });
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'не удалось отправить DM админу про csrf_blocked',
      ),
    );
  });
});
