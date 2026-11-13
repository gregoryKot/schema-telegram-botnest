// AlertLogger — граница error() → DM админу. Проверяем: в DM только место, тип
// и id без текста ошибки (РКН, #1135), полный текст — в stderr с тем же id;
// триггерится только на error(), троттлится 60с по нормализованному ключу
// (I-4, аудит 2026-07: числа/uuid схлопываются, иначе массовый сбой обходит
// троттлинг лавиной DM), старые записи вычищаются, и что AlertLogger никогда
// не бросает исключение наружу, даже если сама доставка алерта падает.
// notifyAdminWithFallback мокается на границе модуля (как в
// security-log.service.spec.ts) — сетевого I/O здесь не должно быть.
import { Logger } from '@nestjs/common';
import { AlertLogger } from './alert.logger';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { dbOutage } from './db-outage';
import { alertId } from './alert-text';
import { moneyAlert } from './money-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const mockedNotify = notifyAdminWithFallback as jest.Mock;
const flush = () => new Promise((r) => setImmediate(r));
/** id, под которым error(msg) логгера с контекстом 'TestService' уходит в DM и в лог. */
const idOf = (message: string) => `id: ${alertId('TestService', message)}`;

beforeEach(() => {
  mockedNotify.mockClear();
  dbOutage.reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('AlertLogger.error — триггерит алерт', () => {
  it('вызывает notifyAdminWithFallback с местом, типом и id — без текста', async () => {
    const logger = new AlertLogger('TestService');
    logger.error('Something broke');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    const [text, subject] = mockedNotify.mock.calls[0];
    expect(text).toBe(
      `🚨 Ошибка на сервере\nМесто: TestService\nТип: —\n${idOf('Something broke')}`,
    );
    expect(subject).toContain('SchemeHappens');
  });

  it('error() ничего не возвращает синхронно и не бросает, даже пока notifyAdminWithFallback ещё выполняется', async () => {
    // Контракт notifyAdminWithFallback — «swallows all errors silently»
    // (см. utils/admin-alert.ts), поэтому сама она никогда не реджектится;
    // здесь проверяем именно синхронную безопасность вызова error().
    mockedNotify.mockImplementationOnce(
      () => new Promise((resolve) => setImmediate(resolve)),
    );
    const logger = new AlertLogger('TestService');
    expect(() => logger.error('boom')).not.toThrow();
    await flush();
  });

  it('не бросает, если message — не строка (объект/Error)', async () => {
    const logger = new AlertLogger('TestService');
    expect(() => logger.error(new Error('oops'))).not.toThrow();
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
  });
});

describe('AlertLogger — методы, отличные от error(), алерт не шлют', () => {
  it('warn/log/debug не вызывают notifyAdminWithFallback', async () => {
    const logger = new AlertLogger('TestService');
    // Санити: методы реально существуют и не бросают (иначе «алерт не шлют»
    // было бы тривиально верно и в случае, когда сами методы сломаны).
    expect(() => logger.warn('careful')).not.toThrow();
    expect(() => logger.log('info')).not.toThrow();
    expect(() => logger.debug?.('debug details')).not.toThrow();
    await flush();
    // Осознанный weak: негативный ассерт «не вызван» структурно не может
    // нести проверку аргументов — вызова, которого не было, не существует.
    expect(mockedNotify).not.toHaveBeenCalled();
  });
});

// Троттлинг завязан на Date.now(), не на таймеры выполнения — управляем
// временем через spyOn(Date, 'now'), а не jest.useFakeTimers: fake-таймеры
// (modern) виснут на await flush()/setImmediate без ручного advance.
describe('AlertLogger — троттлинг одинаковых ошибок (60с)', () => {
  let nowSpy: jest.SpiedFunction<typeof Date.now>;
  const setNow = (t: number) => nowSpy.mockReturnValue(t);

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now');
  });

  it('повтор того же сообщения в течение 60с не шлёт второй алерт', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('TestService');
    logger.error('DB connection failed');
    await flush();
    logger.error('DB connection failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain(
      idOf('DB connection failed'),
    );
  });

  it('после 60с то же сообщение шлёт алерт повторно', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('TestService');
    logger.error('DB connection failed');
    await flush();
    setNow(1_000_000 + 61_000);
    logger.error('DB connection failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    expect(mockedNotify.mock.calls[0][0]).toContain(
      idOf('DB connection failed'),
    );
    expect(mockedNotify.mock.calls[1][0]).toContain(
      idOf('DB connection failed'),
    );
  });

  it('разные сообщения не троттлятся друг другом', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('TestService');
    logger.error('Error A');
    await flush();
    logger.error('Error B');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    expect(mockedNotify.mock.calls[0][0]).toContain(idOf('Error A'));
    expect(mockedNotify.mock.calls[1][0]).toContain(idOf('Error B'));
  });

  it('нормализация ключа: числа схлопываются, "Failed id=1" и "Failed id=2" троттлятся как один (I-4)', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('TestService');
    logger.error('Failed to process id=1');
    await flush();
    logger.error('Failed to process id=2');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    // Второй error() подавлен троттлингом — алерт остался от первого вызова.
    expect(mockedNotify.mock.calls[0][0]).toContain(
      idOf('Failed to process id=1'),
    );
  });

  it('нормализация ключа: uuid схлопывается в плейсхолдер, разные uuid троттлятся как один', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('TestService');
    logger.error('Booking a1b2c3d4-e5f6-7890-abcd-ef1234567890 confirm failed');
    await flush();
    logger.error('Booking ffffffff-1111-2222-3333-444444444444 confirm failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain(
      idOf('Booking a1b2c3d4-e5f6-7890-abcd-ef1234567890 confirm failed'),
    );
  });
});

describe('AlertLogger — eviction старых записей троттлинга (>1ч)', () => {
  it('запись старше часа вычищается — не растёт бесконечно, и повтор шлёт алерт снова', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const logger = new AlertLogger('TestService');
    logger.error('Stale error');
    await flush();

    nowSpy.mockReturnValue(1_000_000 + 3_600_001); // +1h1ms
    // Другая ошибка триггерит цикл эвикции внутри alert()
    logger.error('Another error to trigger sweep');
    await flush();

    logger.error('Stale error'); // ключ должен был эвиктиться → шлёт снова
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(3);
    expect(mockedNotify.mock.calls[0][0]).toContain(idOf('Stale error'));
    expect(mockedNotify.mock.calls[1][0]).toContain(
      idOf('Another error to trigger sweep'),
    );
    expect(mockedNotify.mock.calls[2][0]).toContain(idOf('Stale error'));
  });
});

// M4 (аудит 2026-08): пер-контентный ключ выше нормализует только цифры/uuid.
// Сток с варьируемым атакующим НЕ-цифровым текстом (имена query-параметров,
// текст ошибки парсинга — напр. widget-redirect, GET без auth/throttle) рождает
// новый ключ на каждый запрос и обходит троттл лавиной DM. Общий бюджет за окно
// (15/60с СУММАРНО по всем ключам) — backstop: реальная авария из нескольких
// подсистем проходит, лавина подделанных ключей упирается в потолок.
describe('AlertLogger — общий потолок за окно (M4: текст, варьируемый буквами)', () => {
  let nowSpy: jest.SpiedFunction<typeof Date.now>;
  const setNow = (t: number) => nowSpy.mockReturnValue(t);

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now');
  });

  it('поток из 20 разных ПО БУКВАМ сообщений в одном окне глушится на 15', async () => {
    setNow(2_000_000);
    const logger = new AlertLogger('TestService');
    // Каждое сообщение — уникальный ключ (разная длина буквенного хвоста, без
    // цифр), так что пер-контентный троттл пропускает КАЖДОЕ. Режет только
    // общий бюджет.
    for (let i = 0; i < 20; i++) {
      logger.error(`widget-redirect bad param aaa${'x'.repeat(i)}`);
      await flush();
    }
    expect(mockedNotify).toHaveBeenCalledTimes(15);
    // Доставленные алерты — первые по порядку, каждый со своим id.
    expect(String(mockedNotify.mock.calls[0][0])).toContain(
      idOf('widget-redirect bad param aaa'),
    );
  });

  it('первый алерт следующего окна сообщает, сколько подавил потолок', async () => {
    setNow(2_000_000);
    const logger = new AlertLogger('TestService');
    for (let i = 0; i < 20; i++) {
      logger.error(`variant zzz${'q'.repeat(i)} failed`);
      await flush();
    }
    expect(mockedNotify).toHaveBeenCalledTimes(15); // 5 подавлено потолком

    mockedNotify.mockClear();
    setNow(2_000_000 + 61_000); // окно закрылось
    logger.error('свежая отдельная ошибка в новом окне');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('подавлено ещё 5');
  });

  it('реальная авария из нескольких подсистем (< потолка) проходит целиком', async () => {
    setNow(2_000_000);
    const logger = new AlertLogger('TestService');
    const subsystems = [
      'DB connection lost',
      'Redis timeout',
      'Telegram API 502',
      'encryption key missing',
      'disk full on /data',
    ];
    for (const s of subsystems) {
      logger.error(s);
      await flush();
    }
    // 5 разных подсистем < 15 → ни одна не проглочена потолком, и каждая
    // доехала своим id (а не схлопнулась в один общий ключ).
    expect(mockedNotify).toHaveBeenCalledTimes(5);
    const delivered = mockedNotify.mock.calls.map((c) => String(c[0]));
    for (const s of subsystems) {
      expect(delivered.some((t) => t.includes(idOf(s)))).toBe(true);
    }
  });
});

// Регресс инцидента 2026-08-31: одна авария БД рассыпалась на десятки
// РАЗНЫХ по тексту сообщений (объект Prisma, processQueue, роуты API,
// healthy-adult catch-up) — ни пер-ключевой троттлинг, ни общий бюджет
// (15/60с) не помогали, каждое сообщение — свой ключ. DbOutageTracker
// перехватывает ветку раньше обоих троттлингов и схлопывает всё в 1 DM.
describe('AlertLogger — авария БД схлопывается в один DM (регресс 2026-08-31)', () => {
  it('10 РАЗНЫХ по тексту сообщений одной аварии дают ровно 1 DM', async () => {
    const logger = new AlertLogger('TestService');
    const messages = [
      JSON.stringify({ code: 'P1001', meta: { modelName: 'Booking' } }),
      "processQueue failed: Can't reach database server at 10.96.245.252:5432",
      'Prisma error on /api/auth/refresh: P1001',
      'Prisma error on /api/therapy/tasks: P1001',
      'Prisma error on /api/user-flags: P1001',
      "healthy-adult catch-up failed: Can't reach database server",
      'Server has closed the connection (P1017)',
      'Timed out fetching a new connection from the pool',
      JSON.stringify({ code: 'P1001', meta: { modelName: 'Subscription' } }),
      "Booking notify failed: Can't reach database server at 10.96.245.252:5432",
    ];
    for (const m of messages) {
      logger.error(m);
      await flush();
    }
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('База данных не отвечает');
  });

  it('посторонняя ошибка (не про БД) во время аварии по-прежнему доставляется', async () => {
    const logger = new AlertLogger('TestService');
    logger.error("Can't reach database server at 10.96.245.252:5432");
    await flush();
    mockedNotify.mockClear();
    logger.error('Telegram API 502 Bad Gateway');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain(
      idOf('Telegram API 502 Bad Gateway'),
    );
  });
});

// РКН (#1135): владельцу в Telegram и в письмо — только место, тип и id. Текст
// ошибки (email, имя, ответ площадки, аргументы Prisma) остаётся в логе
// приложения, и по id из DM строка там находится. Письмо-фолбэк получает тот
// же текст: notifyAdminWithFallback принимает один текст на оба канала.
describe('AlertLogger — в DM нет текста ошибки, в логе он есть с тем же id', () => {
  const MARK = /MARK|poison|Ivanov/;
  const logged = () =>
    (process.stderr.write as unknown as jest.Mock).mock.calls
      .map((c) => String(c[0]))
      .join('');
  const dm = () => String(mockedNotify.mock.calls[0][0]);

  class PrismaClientKnownRequestError extends Error {
    name = 'PrismaClientKnownRequestError';
    code = 'P2002';
  }

  it('сообщение и Error с маркерами: в DM место, TypeError и id, маркеры — только в логе', async () => {
    const message = 'Signup failed for MARK-ivan@poison.test (Ivanov)';
    new AlertLogger('TestService').error(
      message,
      new TypeError('MARK-in-message'),
    );
    await flush();
    expect(dm()).toBe(
      `🚨 Ошибка на сервере\nМесто: TestService\nТип: TypeError\n${idOf(message)}`,
    );
    expect(dm()).not.toMatch(MARK);
    expect(logged()).toContain(
      `[alert ${alertId('TestService', message)}] ${message}`,
    );
    expect(logged()).toContain('MARK-in-message');
  });

  it('Prisma-ошибка: тип — имя класса и code, без аргументов запроса', async () => {
    const err = new PrismaClientKnownRequestError(
      'Unique constraint failed: { email: "MARK@poison.test" }',
    );
    new AlertLogger('TestService').error('create user failed', err);
    await flush();
    expect(dm()).toContain('Тип: PrismaClientKnownRequestError P2002');
    expect(dm()).not.toMatch(MARK);
  });

  it('stack-строка вторым аргументом (Nest: message, stack, context): тип из первой строки', async () => {
    new AlertLogger().error(
      'uncaughtException: MARK Ivanov',
      'TypeError: MARK-ivan@poison.test\n    at run (x.ts:1:1)',
      'UncaughtException',
    );
    await flush();
    expect(dm()).toContain('Место: UncaughtException\nТип: TypeError');
    expect(dm()).not.toMatch(MARK);
    expect(logged()).toContain('MARK-ivan@poison.test');
  });

  it('Error первым аргументом: тип из него, текст и stack — только в логе', async () => {
    new AlertLogger('TestService').error(
      new RangeError('MARK-ivan@poison.test'),
    );
    await flush();
    expect(dm()).toContain('Тип: RangeError');
    expect(dm()).not.toMatch(MARK);
    expect(logged()).toMatch(/\[alert [0-9a-f]{8}\] RangeError: MARK-ivan/);
  });

  it('имя, code и stack, не похожие на класс ошибки, в тип не идут', async () => {
    const err = Object.assign(new Error('x'), {
      name: 'MARK Ivanov',
      code: 'mark poison',
    });
    const logger = new AlertLogger('TestService');
    logger.error('first', err);
    logger.error('second', 'Ivanov: MARK-poison\n    at run (x.ts:1:1)');
    await flush();
    const texts = mockedNotify.mock.calls.map((c) => String(c[0]));
    expect(texts).toHaveLength(2);
    for (const t of texts) {
      expect(t).toContain('Тип: —');
      expect(t).not.toMatch(MARK);
    }
  });

  it('последний строковый аргумент не похож на имя класса — место «—»', async () => {
    new AlertLogger().error('lookup failed', 'MARK-ivan@poison.test');
    await flush();
    expect(dm()).toContain('Место: —');
    expect(dm()).not.toMatch(MARK);
  });

  // `logger.error('x', e.message)` у логгера без контекста: Nest считает
  // последнюю строку контекстом, и однословный текст пролез бы в «Место:».
  it.each(['Ivanov', 'Unauthorized', 'MARKIVANOV', 'ivanov@x.ru', 'a.b-c'])(
    'однословный «%s» последним аргументом в место не идёт, но остаётся в логе',
    async (word) => {
      new AlertLogger().error('lookup failed', word);
      await flush();
      expect(dm()).toContain('Место: —');
      expect(dm()).not.toContain(word);
      expect(logged()).toContain(word);
    },
  );

  it('настоящий контекст из имени класса виден: Logger(BookingService), OAuthCallbackService', async () => {
    Logger.overrideLogger(new AlertLogger());
    new Logger('BookingService').error('confirm failed');
    new Logger('OAuthCallbackService').error('vk callback error');
    await flush();
    const texts = mockedNotify.mock.calls.map((c) => String(c[0]));
    expect(texts[0]).toContain('Место: BookingService');
    expect(texts[1]).toContain('Место: OAuthCallbackService');
  });

  it('денежный алерт уходит своим текстом (InvId и сумма) вместе с местом и id', async () => {
    const message = moneyAlert(
      'Robokassa: оплата доната #7 (500 ₽) без строки в БД',
    );
    new AlertLogger('DonationService').error(message);
    await flush();
    expect(dm()).toBe(
      `🚨 Ошибка на сервере\n${message}\nМесто: DonationService\nТип: —\n` +
        `id: ${alertId('DonationService', message)}`,
    );
  });

  it('циклический объект первым аргументом — не бросает, DM уходит', async () => {
    const circular: Record<string, unknown> = { note: 'MARK' };
    circular.self = circular;
    expect(() => new AlertLogger('TestService').error(circular)).not.toThrow();
    await flush();
    expect(dm()).toContain('Место: TestService');
    expect(dm()).not.toMatch(MARK);
  });
});
