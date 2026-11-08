// Регресс аудита 2026-11, S13: аноним выжигал бюджет алертов владельцу.
// POST /api/client-errors открыт без входа и звал logger.error с ключом
// `source|section` — до 24 разных текстов, раз на IP в 5 минут. Общий бюджет
// DM в AlertLogger — 15 в минуту, и ~5 IP каждую минуту выбирали его до дна:
// настоящая ошибка сервера уходила в «подавлено ещё N».
//
// Тест проходит через шов целиком: настоящий ClientErrorsController пишет в
// настоящий AlertLogger, подставленный Nest-логгером (как в main.ts), а
// граница — notifyAdminWithFallback (сеть). Время — одно окно бюджета.
import { Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AlertLogger } from '../logger/alert.logger';
import { ANON_BUDGET } from '../logger/alert-gate';
import { dbOutage } from '../logger/db-outage';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import type { AnalyticsService } from '../analytics/analytics.service';
import { ClientErrorsController } from './client-errors.controller';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const notify = notifyAdminWithFallback as jest.Mock;
const flush = () => new Promise((r) => setImmediate(r));
const sent = () => notify.mock.calls.map((c) => String(c[0]));

// 12 разделов × 2 площадки = 24 разных первых аргумента у старого кода.
const SECTIONS = [
  'auth', 'login.ticket', 'today.tasks', 'Дневник', 'Паттерны', 'Практика',
  'Кабинет', 'booking', 'assets', 'tracker', 'addressForm', 'неизвестный',
]; // prettier-ignore
const SOURCES = ['webapp', 'miniapp'] as const;

describe('S13: анонимный шум не глушит настоящий logger.error', () => {
  beforeEach(() => {
    notify.mockClear();
    dbOutage.reset();
    Logger.overrideLogger(new AlertLogger());
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('100 анонимных отчётов фронтенда с разных IP — настоящая ошибка доходит', async () => {
    const analytics = {
      track: jest.fn().mockResolvedValue(undefined),
    } as unknown as AnalyticsService;
    const controller = new ClientErrorsController(analytics);
    for (let i = 0; i < 100; i++) {
      controller.report(
        {
          message: `boom ${i}`,
          section: SECTIONS[i % SECTIONS.length],
          source: SOURCES[Math.floor(i / SECTIONS.length) % 2],
        },
        { ip: `10.0.${i}.1` } as Request,
      );
    }
    await flush();

    new Logger('PrismaService').error('Настоящая авария: запись брони упала');
    await flush();

    expect(sent().some((t) => t.includes('Настоящая авария'))).toBe(true);
    // Отчёты клиента в DM не идут вовсе — только сводкой раз в час.
    expect(sent().some((t) => t.includes('[client:'))).toBe(false);
  });

  it('шквал анонимных ошибок входа — свой малый подбюджет, основной цел', async () => {
    const google = new Logger('GoogleProvider');
    for (let i = 0; i < 100; i++) {
      google.error(`Google id_token JWT verification failed: ${'x'.repeat(i)}`);
    }
    await flush();
    expect(sent()).toHaveLength(ANON_BUDGET);

    new Logger('PrismaService').error('Настоящая авария: запись брони упала');
    await flush();
    expect(sent()).toHaveLength(ANON_BUDGET + 1);
    expect(sent()[ANON_BUDGET]).toContain('Настоящая авария');
  });
});
