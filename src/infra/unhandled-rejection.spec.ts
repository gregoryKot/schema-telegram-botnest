// Аудит 2026-10 (I6): необработанный reject должен уходить в Logger.error
// (оттуда AlertLogger шлёт DM) и приводить к перезапуску, но не раскрывать
// тело запроса, спрятанное в объекте причины.
import {
  describeRejection,
  registerUnhandledRejectionHandler,
  UNHANDLED_REJECTION_EXIT_DELAY_MS,
} from './unhandled-rejection';

describe('registerUnhandledRejectionHandler', () => {
  afterEach(() => process.removeAllListeners('unhandledRejection'));

  const setup = () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const exit = jest.fn();
    const timers: { fn: () => void; ms: number }[] = [];
    const handler = registerUnhandledRejectionHandler(
      logger,
      exit,
      (fn, ms) => timers.push({ fn, ms }),
    );
    return { logger, exit, timers, handler };
  };

  it('регистрирует обработчик на process.unhandledRejection', () => {
    const { handler } = setup();
    expect(process.listeners('unhandledRejection')).toContain(handler);
  });

  it('логирует через Logger.error message и stack', () => {
    const { logger, handler } = setup();
    const err = new Error('boom');
    handler(err);
    expect(logger.error).toHaveBeenCalledWith(
      'unhandledRejection: boom',
      err.stack,
    );
  });

  it('завершает процесс с кодом 1 не сразу, а после паузы для алерта', () => {
    const { exit, timers, handler } = setup();
    handler(new Error('x'));
    expect(exit).not.toHaveBeenCalled();
    expect(timers[0].ms).toBe(UNHANDLED_REJECTION_EXIT_DELAY_MS);
    timers[0].fn();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('тело запроса из объекта причины в лог не попадает', () => {
    const { logger, handler } = setup();
    handler({ config: { data: 'мой дневник: секрет' }, isAxiosError: true });
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain('дневник');
    expect(logged).toContain('non-Error rejection (object)');
  });

  it('описание строковой причины обрезается', () => {
    expect(describeRejection('a'.repeat(1000)).message).toHaveLength(300);
  });
});
