// Аудит 2026-10 (I6, docs/AUDIT_2026-10_FINDINGS.md «uncaughtException без
// обработчика»): синхронный throw в таймере ронял процесс мимо AlertLogger.
// Исключение обязано уйти в Logger.error (оттуда DM владельцу), процесс —
// выйти с кодом 1 после паузы на алерт, и ровно один раз.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  describeException,
  registerUncaughtExceptionHandler,
} from './uncaught-exception';
import { UNHANDLED_REJECTION_EXIT_DELAY_MS } from './unhandled-rejection';

describe('registerUncaughtExceptionHandler', () => {
  // Снимаем ТОЛЬКО свой обработчик: у раннера jest свои слушатели
  // uncaughtException, removeAllListeners сломал бы изоляцию воркера.
  const registered: ((err: unknown) => void)[] = [];
  afterEach(() => {
    for (const h of registered.splice(0)) {
      process.removeListener('uncaughtException', h);
    }
  });

  const setup = () => {
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const exit = jest.fn();
    const timers: { fn: () => void; ms: number }[] = [];
    const handler = registerUncaughtExceptionHandler(logger, exit, (fn, ms) =>
      timers.push({ fn, ms }),
    );
    registered.push(handler);
    return { logger, exit, timers, handler };
  };

  it('регистрирует обработчик на process.uncaughtException', () => {
    const { handler } = setup();
    expect(process.listeners('uncaughtException')).toContain(handler);
  });

  it('логирует через Logger.error message и stack', () => {
    const { logger, handler } = setup();
    const err = new Error('boom');
    handler(err);
    expect(logger.error).toHaveBeenCalledWith(
      'uncaughtException: boom',
      err.stack,
    );
  });

  it('завершает процесс с кодом 1 не сразу, а после паузы для алерта', () => {
    const { exit, timers, handler } = setup();
    handler(new Error('x'));
    expect(exit).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(UNHANDLED_REJECTION_EXIT_DELAY_MS);
    timers[0].fn();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('два исключения подряд: оба в логе, но выход запланирован один раз', () => {
    const { logger, exit, timers, handler } = setup();
    handler(new Error('first'));
    handler(new Error('second'));
    expect(logger.error.mock.calls.map((c) => c[0])).toEqual([
      'uncaughtException: first',
      'uncaughtException: second',
    ]);
    expect(timers).toHaveLength(1);
    timers.forEach((t) => t.fn());
    expect(exit.mock.calls).toEqual([[1]]);
  });

  it('тело запроса из объекта ошибки в лог не попадает', () => {
    const { logger, handler } = setup();
    handler({
      config: { data: 'мой дневник: секрет' },
      request: { headers: { authorization: 'Bearer tok' } },
    });
    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toContain('дневник');
    expect(logged).not.toContain('Bearer');
    expect(logged).toContain('uncaughtException: non-Error exception (object)');
  });

  it('строковое исключение пишется текстом и обрезается', () => {
    expect(describeException('oops')).toEqual({ message: 'oops' });
    expect(describeException('a'.repeat(1000)).message).toHaveLength(300);
  });
});

// Шов (правило №14): моки выше проверяют, что обработчик делает, но не то,
// что Node на самом деле отдаёт ему throw из таймера и не роняет процесс
// раньше паузы на алерт. Поэтому — настоящий дочерний процесс.
describe('uncaughtException в живом процессе Node', () => {
  it('throw в таймере доходит до logger.error, выход с кодом 1 после паузы', () => {
    const script = `
      const { registerUncaughtExceptionHandler } = require(${JSON.stringify(
        join(__dirname, 'uncaught-exception'),
      )});
      registerUncaughtExceptionHandler({
        error: (m) => process.stdout.write('LOGGED ' + m + '\\n'),
        log() {},
        warn() {},
      });
      const t0 = Date.now();
      process.on('exit', () =>
        process.stdout.write('ELAPSED ' + (Date.now() - t0) + '\\n'),
      );
      setTimeout(() => { throw new Error('seam-boom'); }, 0);
    `;
    const r = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', '-e', script],
      { encoding: 'utf8', timeout: 20_000 },
    );
    expect(r.stdout).toContain('LOGGED uncaughtException: seam-boom');
    expect(r.status).toBe(1);
    // Штатный крах Node печатает стек в stderr и выходит сразу.
    expect(r.stderr).not.toContain('seam-boom');
    const elapsed = Number(/ELAPSED (\d+)/.exec(r.stdout)?.[1]);
    expect(elapsed).toBeGreaterThanOrEqual(
      UNHANDLED_REJECTION_EXIT_DELAY_MS - 50,
    );
  }, 30_000);
});
