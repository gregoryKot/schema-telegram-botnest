import { ConceptGraphMetricsService } from './concept-graph-metrics.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const SINCE = new Date(NOW.getTime() - 30 * 86_400_000);

function makeService(opts: {
  opens?: number;
  linked?: number;
  schemaLinked?: number;
  canvas?: number;
  fullscreen?: number;
  saveRetry?: number;
  groups?: Array<{ userId: bigint | null }>;
}) {
  const byName: Record<string, number> = {
    concept_graph_open: opts.opens ?? 0,
    concept_mode_linked: opts.linked ?? 0,
    concept_schema_linked: opts.schemaLinked ?? 0,
    concept_canvas_open: opts.canvas ?? 0,
    concept_graph_fullscreen: opts.fullscreen ?? 0,
    concept_save_retry: opts.saveRetry ?? 0,
  };
  const count = jest.fn(({ where }: { where: { name: string } }) =>
    Promise.resolve(byName[where.name]),
  );
  const groupBy = jest.fn(() => Promise.resolve(opts.groups ?? []));
  const prisma = { analyticsEvent: { count, groupBy } };
  return {
    service: new ConceptGraphMetricsService(prisma as never),
    count,
    groupBy,
  };
}

describe('ConceptGraphMetricsService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('считает открытия, терапевтов и заполненные связи за 30 дней', async () => {
    const { service } = makeService({
      opens: 14,
      linked: 9,
      schemaLinked: 6,
      canvas: 4,
      fullscreen: 5,
      groups: [{ userId: 1n }, { userId: 2n }, { userId: 3n }],
    });
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 14,
      therapists30: 3,
      linked30: 9,
      schemaLinked30: 6,
      canvasOpen30: 4,
      fullscreen30: 5,
      saveRetry30: 0,
    });
  });

  it('спрашивает нужные события и окно createdAt >= 30 дней назад', async () => {
    const { service, count, groupBy } = makeService({});
    await service.getMetrics();

    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_graph_open', createdAt: { gte: SINCE } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_mode_linked', createdAt: { gte: SINCE } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_schema_linked', createdAt: { gte: SINCE } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_canvas_open', createdAt: { gte: SINCE } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_graph_fullscreen', createdAt: { gte: SINCE } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_save_retry', createdAt: { gte: SINCE } },
    });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it('переносы на холст считаются отдельно: чужие события в их счёт не попадают', async () => {
    const { service } = makeService({ canvas: 7 });
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      therapists30: 0,
      linked30: 0,
      schemaLinked30: 0,
      canvasOpen30: 7,
      fullscreen30: 0,
      saveRetry30: 0,
    });
    await expect(service.render()).resolves.toContain(
      'Переносили схему случая на холст 7 раз',
    );
  });

  it('развороты на весь экран считаются отдельно: чужие события в их счёт не попадают', async () => {
    const { service } = makeService({ fullscreen: 6 });
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      therapists30: 0,
      linked30: 0,
      schemaLinked30: 0,
      canvasOpen30: 0,
      fullscreen30: 6,
      saveRetry30: 0,
    });
    await expect(service.render()).resolves.toContain(
      'Разворачивали схему на весь экран 6 раз',
    );
  });

  it('повторы сохранения после ошибки считаются отдельно и видны в /stats (#879)', async () => {
    const { service } = makeService({ saveRetry: 3 });
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      therapists30: 0,
      linked30: 0,
      schemaLinked30: 0,
      canvasOpen30: 0,
      fullscreen30: 0,
      saveRetry30: 3,
    });
    await expect(service.render()).resolves.toContain(
      'Повторяли сохранение после ошибки 3 раз',
    );
  });

  it('терапевты — distinct по userId, анонимная строка (null) не в счёт', async () => {
    const { service, groupBy } = makeService({
      opens: 4,
      groups: [{ userId: 7n }],
    });
    const m = await service.getMetrics();

    expect(m.therapists30).toBe(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: {
        name: 'concept_graph_open',
        createdAt: { gte: SINCE },
        userId: { not: null },
      },
    });
  });

  it('пустая БД: нули, а render() — человеческая строка без мусора', async () => {
    const { service } = makeService({});
    await expect(service.getMetrics()).resolves.toEqual({
      opens30: 0,
      therapists30: 0,
      linked30: 0,
      schemaLinked30: 0,
      canvasOpen30: 0,
      fullscreen30: 0,
      saveRetry30: 0,
    });
    const text = await service.render();
    expect(text).toContain('Пока никто из терапевтов не открывал');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('render() склеивает метрики в блок для /stats', async () => {
    const { service } = makeService({
      opens: 6,
      linked: 2,
      schemaLinked: 3,
      canvas: 5,
      fullscreen: 4,
      groups: [{ userId: 1n }, { userId: 2n }],
    });
    const text = await service.render();
    expect(text).toContain('Переносили схему случая на холст 5 раз');
    expect(text).toContain('Разворачивали схему на весь экран 4 раз');
    expect(text).not.toContain('Повторяли сохранение'); // 0 повторов — строки нет
    expect(text).toContain('Открывали 6 раз, терапевтов: 2');
    expect(text).toContain('Связи режимов заполняли 2 раз');
    expect(text).toContain('Убеждения и опыт схем записывали 3 раз');
  });
});
