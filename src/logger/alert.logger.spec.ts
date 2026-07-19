// AlertLogger (36 строк) — граница error() → DM админу. Проверяем: триггерится
// только на error(), троттлится 60с по нормализованному ключу (I-4, аудит
// 2026-07: числа/uuid схлопываются, иначе массовый сбой обходит троттлинг
// лавиной DM), старые записи вычищаются, и что AlertLogger никогда не бросает
// исключение наружу, даже если сама доставка алерта падает.
// notifyAdminWithFallback мокается на границе модуля (как в
// security-log.service.spec.ts) — сетевого I/O здесь не должно быть.
import { AlertLogger } from './alert.logger';
import { notifyAdminWithFallback } from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const mockedNotify = notifyAdminWithFallback as jest.Mock;
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  mockedNotify.mockClear();
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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    logger.warn('careful');
    logger.log('info');
    logger.debug?.('debug details');
    await flush();
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
  });

  it('разные сообщения не троттлятся друг другом', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Error A');
    await flush();
    logger.error('Error B');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(2);
  });

  it('нормализация ключа: числа схлопываются, "Failed id=1" и "Failed id=2" троттлятся как один (I-4)', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Failed to process id=1');
    await flush();
    logger.error('Failed to process id=2');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
  });

  it('нормализация ключа: uuid схлопывается в плейсхолдер, разные uuid троттлятся как один', async () => {
    setNow(1_000_000);
    const logger = new AlertLogger('Test');
    logger.error('Booking a1b2c3d4-e5f6-7890-abcd-ef1234567890 confirm failed');
    await flush();
    logger.error('Booking ffffffff-1111-2222-3333-444444444444 confirm failed');
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(1);
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
  });
});
