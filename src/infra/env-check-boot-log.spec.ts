// Уровень лога по режиму (error в проде, warn иначе) + ОДНО сообщение со
// всем списком разом (не по одному на переменную — AlertLogger троттлит по
// нормализованному ключу первых 100 символов, десять отдельных .error()
// легко ушли бы как десять разных ключей — десять DM админу за один старт).
import { logEnvCheck, formatEnvCheckLines } from './env-check-boot-log';
import { EnvCheckResult } from './env-check';

const EMPTY: EnvCheckResult = {
  missing: [],
  invalid: [],
  crossCheckIssues: [],
};
const WITH_ISSUES: EnvCheckResult = {
  missing: ['BOT_TOKEN', 'ADMIN_ID'],
  invalid: [{ name: 'JWT_SECRET', problem: 'пустая строка' }],
  crossCheckIssues: [
    { id: 'x', problem: 'RESEND_API_KEY задан, но не задан(ы) ADMIN_EMAIL' },
  ],
};

function makeLogger() {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('formatEnvCheckLines', () => {
  it('пусто — пустой массив строк', () => {
    expect(formatEnvCheckLines(EMPTY)).toEqual([]);
  });

  it('собирает missing/invalid/crossCheckIssues человеческим текстом', () => {
    const lines = formatEnvCheckLines(WITH_ISSUES);
    expect(lines).toEqual([
      'не задано: BOT_TOKEN, ADMIN_ID',
      'неверный формат JWT_SECRET: пустая строка',
      'RESEND_API_KEY задан, но не задан(ы) ADMIN_EMAIL',
    ]);
  });
});

describe('logEnvCheck', () => {
  it('нет проблем — одно info-сообщение через logger.log, error/warn не зовутся', () => {
    const logger = makeLogger();
    logEnvCheck(logger, EMPTY, 'production');
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('есть проблемы в production — ровно один logger.error со всем списком', () => {
    const logger = makeLogger();
    logEnvCheck(logger, WITH_ISSUES, 'production');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    const [message] = logger.error.mock.calls[0];
    expect(message).toContain('BOT_TOKEN');
    expect(message).toContain('ADMIN_ID');
    expect(message).toContain('JWT_SECRET');
    expect(message).toContain('ADMIN_EMAIL');
  });

  it('есть проблемы вне production — ровно один logger.warn, приложение не падает', () => {
    const logger = makeLogger();
    expect(() => logEnvCheck(logger, WITH_ISSUES, 'development')).not.toThrow();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
