// AlertLogger (36 строк) — граница error() → DM админу. Проверяем: триггерится
// только на error(), троттлится 60с по нормализованному ключу (I-4, аудит
// 2026-07: числа/uuid схлопываются, иначе массовый сбой обходит троттлинг
// лавиной DM), старые записи вычищаются, и что AlertLogger никогда не бросает
// исключение наружу, даже если сама доставка алерта падает.
// notifyAdminWithFallback мокается на границе модуля (как в
// security-log.service.spec.ts) — сетевого I/O здесь не должно быть.
import { AlertLogger } from './alert.logger';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { dbOutage } from './db-outage';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const mockedNotify = notifyAdminWithFallback as jest.Mock;
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  mockedNotify.mockClear();
  dbOutage.reset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('AlertLogger.error — триггерит алерт', () => {
  it('вызывает notifyAdminWithFallback с текстом ошибки', async () => {
    const logger = new AlertLogger('Test');
    logger.error('Something broke');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    const [text, subject] = mockedNotify.mock.calls[0];
    expect(text).toContain('Something broke');
    expect(subject).toContain('SchemeHappens');
  });

  it('обрезает сообщение до 300 символов в алерте', async () => {
    const logger = new AlertLogger('Test');
    logger.error('x'.repeat(500));
    await flush();
    const [text] = mockedNotify.mock.calls[0];
    // "🚨 Ошибка на сервере\n" + до 300 символов сообщения
    expect(text.length).toBeLessThanOrEqual(300 + 30);
  });

  it('error() ничего не возвращает синхронно и не бросает, даже пока notifyAdminWithFallback ещё выполняется', async () => {
    // Контракт notifyAdminWithFallback — «swallows all errors silently»
    // (см. utils/admin-alert.ts), поэтому сама она никогда не реджектится;
    // здесь проверяем именно синхронную безопасность вызова error().
    mockedNotify.mockImplementationOnce(
      () => new Promise((resolve) => setImmediate(resolve)),
    );
    const logger = new AlertLogger('Test');
    expect(() => logger.error('boom')).not.toThrow();
    await flush();
  });

  it('не бросает, если message — не строка (объект/Error)', async () => {
    const logger = new AlertLogger('Test');
    expect(() => logger.error(new Error('oops'))).not.toThrow();
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
  });
});

describe('AlertLogger — методы, отличные от error(), алерт не шлют', () => {
  it('warn/log/debug не вызывают notifyAdminWithFallback', async () => {
    const logger = new AlertLogger('Test');
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
    const logger = new AlertLogger('Test');
    logger.error('DB connection failed');
    await flush();
    logger.error('DB connection failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('DB connection failed');
  });

  it('после 60с то же сообщение шлёт алерт повторно', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('DB connection failed');
    await flush();
    setNow(1_000_000 + 61_000);
    logger.error('DB connection failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    expect(mockedNotify.mock.calls[0][0]).toContain('DB connection failed');
    expect(mockedNotify.mock.calls[1][0]).toContain('DB connection failed');
  });

  it('разные сообщения не троттлятся друг другом', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Error A');
    await flush();
    logger.error('Error B');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
    expect(mockedNotify.mock.calls[0][0]).toContain('Error A');
    expect(mockedNotify.mock.calls[1][0]).toContain('Error B');
  });

  it('нормализация ключа: числа схлопываются, "Failed id=1" и "Failed id=2" троттлятся как один (I-4)', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Failed to process id=1');
    await flush();
    logger.error('Failed to process id=2');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    // Второй error() подавлен троттлингом — алерт остался от первого вызова.
    expect(mockedNotify.mock.calls[0][0]).toContain('Failed to process id=1');
  });

  it('нормализация ключа: uuid схлопывается в плейсхолдер, разные uuid троттлятся как один', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Booking a1b2c3d4-e5f6-7890-abcd-ef1234567890 confirm failed');
    await flush();
    logger.error('Booking ffffffff-1111-2222-3333-444444444444 confirm failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain(
      'Booking a1b2c3d4-e5f6-7890-abcd-ef1234567890 confirm failed',
    );
  });
});

describe('AlertLogger — eviction старых записей троттлинга (>1ч)', () => {
  it('запись старше часа вычищается — не растёт бесконечно, и повтор шлёт алерт снова', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Stale error');
    await flush();

    nowSpy.mockReturnValue(1_000_000 + 3_600_001); // +1h1ms
    // Другая ошибка триггерит цикл эвикции внутри alert()
    logger.error('Another error to trigger sweep');
    await flush();

    logger.error('Stale error'); // ключ должен был эвиктиться → шлёт снова
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(3);
    expect(mockedNotify.mock.calls[0][0]).toContain('Stale error');
    expect(mockedNotify.mock.calls[1][0]).toContain(
      'Another error to trigger sweep',
    );
    expect(mockedNotify.mock.calls[2][0]).toContain('Stale error');
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
    const logger = new AlertLogger('Test');
    // Каждое сообщение — уникальный ключ (разная длина буквенного хвоста, без
    // цифр), так что пер-контентный троттл пропускает КАЖДОЕ. Режет только
    // общий бюджет.
    for (let i = 0; i < 20; i++) {
      logger.error(`widget-redirect bad param aaa${'x'.repeat(i)}`);
      await flush();
    }
    expect(mockedNotify).toHaveBeenCalledTimes(15);
    // Доставленные алерты несут реальный текст ошибки, а не мусор.
    expect(String(mockedNotify.mock.calls[0][0])).toContain(
      'widget-redirect bad param',
    );
  });

  it('первый алерт следующего окна сообщает, сколько подавил потолок', async () => {
    setNow(2_000_000);
    const logger = new AlertLogger('Test');
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
    const logger = new AlertLogger('Test');
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
    // доехала своим текстом (а не схлопнулась в один общий ключ).
    expect(mockedNotify).toHaveBeenCalledTimes(5);
    const delivered = mockedNotify.mock.calls.map((c) => String(c[0]));
    for (const s of subsystems) {
      expect(delivered.some((t) => t.includes(s))).toBe(true);
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
    const logger = new AlertLogger('Test');
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
    const logger = new AlertLogger('Test');
    logger.error("Can't reach database server at 10.96.245.252:5432");
    await flush();
    mockedNotify.mockClear();
    logger.error('Telegram API 502 Bad Gateway');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
    expect(mockedNotify.mock.calls[0][0]).toContain('Telegram API 502');
  });
});
