// Админ-аналитика сайта: гейт по x-admin-key и что ручки зовут нужный сервис.
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AnalyticsAdminController } from './analytics-admin.controller';
import type { AdminAnalyticsService } from '../analytics/admin/admin-analytics.service';
import type { BotAdminStatsService } from '../bot/bot.admin-stats.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { StatsReportService } from '../bot/stats-report.service';
import { STATS_SECTIONS } from '../bot/stats-sections';
import { collectMainStats, collectStatsSection } from './stats-screens';

jest.mock('./stats-screens', () => ({
  collectMainStats: jest.fn().mockResolvedValue('главные цифры'),
  collectStatsSection: jest.fn().mockResolvedValue('текст раздела'),
}));

const KEY = 'test-admin-key-1234-0123456789abcdefghij';

function setup() {
  const analytics = {
    overview: jest.fn().mockResolvedValue({ o: 1 }),
    therapists: jest.fn().mockResolvedValue({ t: 1 }),
    people: jest.fn().mockResolvedValue({ p: 1 }),
  } as unknown as jest.Mocked<
    Pick<AdminAnalyticsService, 'overview' | 'therapists' | 'people'>
  >;
  const config = { get: jest.fn(() => KEY) } as unknown as ConfigService;
  const controller = new AnalyticsAdminController(
    analytics,
    {} as BotAdminStatsService,
    {} as StatsReportService,
    {} as HealthyAdultService,
    config,
  );
  return { controller, analytics };
}

describe('AnalyticsAdminController', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['wrong-key', '', undefined])(
    'ключ %p отвергается на всех ручках, сервисы не вызваны',
    async (bad) => {
      const { controller, analytics } = setup();
      const k = bad as string;
      const calls = [
        () => controller.overview({}, k),
        () => controller.therapists({}, k),
        () => controller.people({}, k),
        () => controller.sections(k),
        () => controller.section('main', k),
      ];
      for (const call of calls)
        await expect(async () => call()).rejects.toThrow();
      expect(analytics.overview).not.toHaveBeenCalled();
      expect(analytics.therapists).not.toHaveBeenCalled();
      expect(analytics.people).not.toHaveBeenCalled();
      expect(collectMainStats).not.toHaveBeenCalled();
      expect(collectStatsSection).not.toHaveBeenCalled();
    },
  );

  it.each(['overview', 'therapists', 'people'] as const)(
    '%s: days из запроса, без days — 30',
    async (name) => {
      const { controller, analytics } = setup();
      await controller[name]({ days: 7 }, KEY);
      expect(analytics[name]).toHaveBeenLastCalledWith(7);
      await controller[name]({}, KEY);
      expect(analytics[name]).toHaveBeenLastCalledWith(30);
    },
  );

  it('sections: сначала main, затем разделы только с id и title', () => {
    const { controller } = setup();
    const res = controller.sections(KEY);
    expect(res[0]).toEqual({ id: 'main', title: 'Главные цифры' });
    expect(res.slice(1)).toEqual(
      STATS_SECTIONS.map(({ id, title }) => ({ id, title })),
    );
  });

  it('section: main отдаёт главные цифры', async () => {
    const { controller } = setup();
    expect(await controller.section('main', KEY)).toEqual({
      id: 'main',
      title: 'Главные цифры',
      text: 'главные цифры',
    });
  });

  it('section: известный id — текст раздела, неизвестный — 404', async () => {
    const { controller } = setup();
    const known = STATS_SECTIONS[0];
    expect(await controller.section(known.id, KEY)).toEqual({
      id: known.id,
      title: known.title,
      text: 'текст раздела',
    });
    await expect(controller.section('nope', KEY)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
