// Агрегат баннеров-переходов: маппинг bigint→number, разбивка по meta.banner
// для переходов и скрытий. Prisma мокается.
import { WebBannerMetricsService } from './web-banner-metrics.service';

describe('WebBannerMetricsService.getMetrics', () => {
  const build = (
    opens: Array<{ banner: string | null; c: bigint }>,
    dismisses: Array<{ banner: string | null; c: bigint }>,
  ) => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(opens)
      .mockResolvedValueOnce(dismisses);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new WebBannerMetricsService(prisma), queryRaw };
  };

  it('собирает переходы и скрытия по баннерам, bigint → number', async () => {
    const { service } = build(
      [
        { banner: 'mobile_app', c: 25n },
        { banner: 'cabinet_full', c: 10n },
      ],
      [{ banner: 'mode_map', c: 4n }],
    );
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: [
        { banner: 'mobile_app', count: 25 },
        { banner: 'cabinet_full', count: 10 },
      ],
      dismisses30: [{ banner: 'mode_map', count: 4 }],
    });
  });

  it('пустая БД даёт пустые списки, а не NaN/undefined', async () => {
    const { service } = build([], []);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: [],
      dismisses30: [],
    });
  });

  it('строка с banner=null отбрасывается из разбивки (не теряя типов)', async () => {
    const { service } = build([{ banner: null, c: 3n }], []);
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: [],
      dismisses30: [],
    });
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([{ banner: 'mobile_app', c: 5n }], []);
    await expect(service.render()).resolves.toContain(
      'Сайт: открыть приложение — 5',
    );
  });
});
