// Агрегат блока «Игра»: раскладка bigint→number по граням (src/chapter/place)
// и сворачивание неизвестных значений по правилам из ТЗ (мусорный src → other,
// мусорный chapter выпадает из воронки целиком, мусорный place не идёт в
// разбивку, но считается в totals ctaClicks). Prisma мокается.
import { GameMetricsService } from './game-metrics.service';

describe('GameMetricsService.getMetrics', () => {
  const build = (rows: Array<Record<string, unknown>>) => {
    const queryRaw = jest.fn().mockResolvedValueOnce(rows);
    const prisma = { $queryRaw: queryRaw } as never;
    return { service: new GameMetricsService(prisma), queryRaw };
  };

  const row = (
    name: string,
    c: number,
    extra: {
      chapter?: string | null;
      place?: string | null;
      src?: string | null;
    } = {},
  ) => ({
    name,
    chapter: extra.chapter ?? null,
    place: extra.place ?? null,
    src: extra.src ?? null,
    c: BigInt(c),
  });

  it('пустой результат запроса — все счётчики нули, chapters — 4 записи нулей', async () => {
    const { service } = build([]);
    const m = await service.getMetrics();
    expect(m.opens).toBe(0);
    expect(m.starts).toBe(0);
    expect(m.ctaShown).toBe(0);
    expect(m.ctaClicks).toBe(0);
    expect(m.shares).toBe(0);
    expect(m.chapters).toHaveLength(4);
    for (const c of m.chapters) {
      expect(c).toEqual(
        expect.objectContaining({ started: 0, finished: 0, deaths: 0 }),
      );
    }
    for (const src of Object.values(m.opensBySource)) expect(src).toBe(0);
    for (const p of Object.values(m.ctaClicksByPlace)) expect(p).toBe(0);
  });

  it('раскладывает открытия по известным источникам, суммирует в totals', async () => {
    const { service } = build([
      row('game_open', 10, { src: 'site' }),
      row('game_open', 4, { src: 'bot' }),
    ]);
    const m = await service.getMetrics();
    expect(m.opens).toBe(14);
    expect(m.opensBySource.site).toBe(10);
    expect(m.opensBySource.bot).toBe(4);
    expect(m.opensBySource.other).toBe(0);
  });

  it('мусорный/отсутствующий src сворачивается в other, событие не теряется', async () => {
    const { service } = build([
      row('game_open', 3, { src: 'vk' }),
      row('game_open', 2, { src: null }),
    ]);
    const m = await service.getMetrics();
    expect(m.opens).toBe(5);
    expect(m.opensBySource.other).toBe(5);
  });

  it('раскладывает воронку глав по известным главам', async () => {
    const { service } = build([
      row('game_chapter_start', 55, { chapter: 'chapter2' }),
      row('game_chapter_done', 30, { chapter: 'chapter2' }),
      row('game_over', 70, { chapter: 'chapter2' }),
      row('game_chapter_start', 90, { chapter: 'chapter1' }),
    ]);
    const m = await service.getMetrics();
    const ch2 = m.chapters.find((c) => c.chapter === 'chapter2')!;
    expect(ch2).toEqual({
      chapter: 'chapter2',
      started: 55,
      finished: 30,
      deaths: 70,
    });
    const ch1 = m.chapters.find((c) => c.chapter === 'chapter1')!;
    expect(ch1.started).toBe(90);
  });

  it('глава вне GAME_CHAPTERS не участвует в totals (защита от рассинхрона)', async () => {
    const { service } = build([
      row('game_chapter_start', 7, { chapter: 'chapter9' }),
      row('game_over', 3, { chapter: null }),
    ]);
    const m = await service.getMetrics();
    for (const c of m.chapters) expect(c.started).toBe(0);
    for (const c of m.chapters) expect(c.deaths).toBe(0);
  });

  it('cta_click: известное место считается и в totals, и в разбивке', async () => {
    const { service } = build([
      row('game_cta_shown', 40, { place: 'act1' }),
      row('game_cta_click', 10, { place: 'act1' }),
      row('game_cta_click', 5, { place: 'cabinet' }),
    ]);
    const m = await service.getMetrics();
    expect(m.ctaShown).toBe(40);
    expect(m.ctaClicks).toBe(15);
    expect(m.ctaClicksByPlace.act1).toBe(10);
    expect(m.ctaClicksByPlace.cabinet).toBe(5);
  });

  it('cta_click с мусорным местом считается в totals, но не в разбивке', async () => {
    const { service } = build([row('game_cta_click', 6, { place: 'menu' })]);
    const m = await service.getMetrics();
    expect(m.ctaClicks).toBe(6);
    for (const p of Object.values(m.ctaClicksByPlace)) expect(p).toBe(0);
  });

  it('простые счётчики (start/tutorial/share) не путаются между собой', async () => {
    const { service } = build([
      row('game_start', 20),
      row('game_tutorial_done', 14),
      row('game_tutorial_skip', 6),
      row('game_share', 9),
    ]);
    const m = await service.getMetrics();
    expect(m.starts).toBe(20);
    expect(m.tutorialDone).toBe(14);
    expect(m.tutorialSkipped).toBe(6);
    expect(m.shares).toBe(9);
  });

  it('ходит в БД один раз, с окном не короче 29 дней', async () => {
    const { service, queryRaw } = build([row('game_open', 1, { src: 'site' })]);
    await service.getMetrics();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    // Голое toHaveBeenCalledTimes(1) не ловит захардкоженное/перепутанное
    // окно — проверяем, что реально ушла граница ~30 дней назад, а не,
    // скажем, 30 часов.
    const sql = queryRaw.mock.calls[0][0] as { values: unknown[] };
    const since30 = sql.values.find((v) => v instanceof Date) as Date;
    expect(since30).toBeInstanceOf(Date);
    const daysAgo = (Date.now() - since30.getTime()) / 86_400_000;
    expect(daysAgo).toBeGreaterThanOrEqual(29);
    expect(daysAgo).toBeLessThan(31);
  });

  it('render() отдаёт готовый текстовый блок для /stats', async () => {
    const { service } = build([row('game_share', 3)]);
    await expect(service.render()).resolves.toContain('Поделились игрой: 3');
  });
});
