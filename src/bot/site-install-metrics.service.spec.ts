// Агрегат «Установка с сайта»: раскладка строк surface+action → структура,
// bigint → number, NULL/неизвестные комбинации игнорируются. Prisma мокается.
import { SiteInstallMetricsService } from './site-install-metrics.service';

describe('SiteInstallMetricsService.getMetrics', () => {
  const build = (
    rows: Array<{ surface: string | null; action: string | null; c: bigint }>,
  ) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new SiteInstallMetricsService(prisma), queryRaw };
  };

  it('раскладывает баннер и лендинг по action, bigint → number', async () => {
    const { service } = build([
      { surface: 'site_banner', action: 'shown', c: 40n },
      { surface: 'site_banner', action: 'add', c: 18n },
      { surface: 'site_banner', action: 'added', c: 12n },
      { surface: 'site_landing', action: 'add', c: 25n },
      { surface: 'site_landing', action: 'added', c: 9n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      banner: { shown30: 40, add30: 18, added30: 12 },
      landing: { add30: 25, added30: 9 },
    });
  });

  it('пустая БД — все нули, а не NaN/undefined', async () => {
    const { service } = build([]);
    await expect(service.getMetrics()).resolves.toEqual({
      banner: { shown30: 0, add30: 0, added30: 0 },
      landing: { add30: 0, added30: 0 },
    });
  });

  it('лендинг shown отсутствует физически (аноним его не шлёт) — banner.shown не путается с landing', async () => {
    const { service } = build([
      { surface: 'site_landing', action: 'add', c: 3n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      banner: { shown30: 0, add30: 0, added30: 0 },
      landing: { add30: 3, added30: 0 },
    });
  });

  it('NULL/неизвестные surface-action комбинации игнорируются', async () => {
    const { service } = build([
      { surface: null, action: 'add', c: 5n },
      { surface: 'site_banner', action: null, c: 6n },
      { surface: 'unknown_surface', action: 'add', c: 7n },
      { surface: 'site_banner', action: 'bogus_action', c: 8n },
      { surface: 'site_banner', action: 'add', c: 2n },
    ]);
    await expect(service.getMetrics()).resolves.toEqual({
      banner: { shown30: 0, add30: 2, added30: 0 },
      landing: { add30: 0, added30: 0 },
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([
      { surface: 'site_landing', action: 'add', c: 5n },
    ]);
    await expect(service.render()).resolves.toContain(
      'Лендинг: нажали установить 5',
    );
  });
});
