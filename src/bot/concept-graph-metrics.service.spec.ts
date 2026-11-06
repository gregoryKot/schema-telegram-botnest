import { ConceptGraphMetricsService } from './concept-graph-metrics.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');
// Показ схемы клиенту — нули там, где кейс про другое.
const NO_SHARE = {
  sharedNow: 0,
  shareOn30: 0,
  shareOff30: 0,
  clientOpens30: 0,
  clientOpeners30: 0,
};
const SINCE = new Date(NOW.getTime() - 30 * 86_400_000);

function makeService(opts: {
  opens?: number;
  linked?: number;
  schemaLinked?: number;
  canvas?: number;
  fullscreen?: number;
  saveRetry?: number;
  brief?: number;
  syncToMap?: number;
  syncFromMap?: number;
  groups?: Array<{ userId: bigint | null }>;
  shareOn?: number;
  shareOff?: number;
  sharedNow?: number;
  clientOpens?: number;
  clientGroups?: Array<{ userId: bigint | null }>;
}) {
  const byName: Record<string, number> = {
    concept_graph_open: opts.opens ?? 0,
    concept_mode_linked: opts.linked ?? 0,
    concept_schema_linked: opts.schemaLinked ?? 0,
    concept_canvas_open: opts.canvas ?? 0,
    concept_graph_fullscreen: opts.fullscreen ?? 0,
    concept_save_retry: opts.saveRetry ?? 0,
    concept_brief_open: opts.brief ?? 0,
    concept_sync_to_map: opts.syncToMap ?? 0,
    concept_sync_from_map: opts.syncFromMap ?? 0,
    client_concept_opened: opts.clientOpens ?? 0,
  };
  // concept_shared различается по meta.on (включили / выключили показ).
  const count = jest.fn(
    ({ where }: { where: { name: string; meta?: { equals: boolean } } }) =>
      Promise.resolve(
        where.meta
          ? ((where.meta.equals ? opts.shareOn : opts.shareOff) ?? 0)
          : byName[where.name],
      ),
  );
  const groupBy = jest.fn(({ where }: { where: { name: string } }) =>
    Promise.resolve(
      (where.name === 'client_concept_opened'
        ? opts.clientGroups
        : opts.groups) ?? [],
    ),
  );
  const conceptCount = jest.fn(() => Promise.resolve(opts.sharedNow ?? 0));
  const prisma = {
    analyticsEvent: { count, groupBy },
    clientConceptualization: { count: conceptCount },
  };
  return {
    service: new ConceptGraphMetricsService(prisma as never),
    count,
    groupBy,
    conceptCount,
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
      brief30: 0,
      syncToMap30: 0,
      syncFromMap30: 0,
      ...NO_SHARE,
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
    expect(groupBy).toHaveBeenCalledTimes(2); // терапевты схемы и клиенты, открывшие свою
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
      brief30: 0,
      syncToMap30: 0,
      syncFromMap30: 0,
      ...NO_SHARE,
    });
    await expect(service.render()).resolves.toContain(
      'Собирали карту из концептуализации 7 раз',
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
      brief30: 0,
      syncToMap30: 0,
      syncFromMap30: 0,
      ...NO_SHARE,
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
      brief30: 0,
      syncToMap30: 0,
      syncFromMap30: 0,
      ...NO_SHARE,
    });
    await expect(service.render()).resolves.toContain(
      'Повторяли сохранение после ошибки 3 раз',
    );
  });

  it('связь холста с полями (#963): оба направления считаются отдельно и видны в /stats', async () => {
    const { service, count } = makeService({ syncToMap: 4, syncFromMap: 9 });
    await expect(service.getMetrics()).resolves.toMatchObject({
      opens30: 0,
      canvasOpen30: 0,
      syncToMap30: 4,
      syncFromMap30: 9,
    });
    expect(count).toHaveBeenCalledWith({
      where: { name: 'concept_sync_from_map', createdAt: { gte: SINCE } },
    });
    const text = await service.render();
    expect(text).toContain('Дописывали на карту из полей: 4 раз');
    expect(text).toContain('Холст дописывал в концептуализацию: 9 раз');
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
      brief30: 0,
      syncToMap30: 0,
      syncFromMap30: 0,
      ...NO_SHARE,
    });
    const text = await service.render();
    expect(text).toContain('Пока никто из терапевтов не открывал');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('показ схемы клиенту: включения и выключения по meta.on, показанные сейчас, клиенты', async () => {
    const { service, count, groupBy, conceptCount } = makeService({
      shareOn: 5,
      shareOff: 2,
      sharedNow: 3,
      clientOpens: 8,
      clientGroups: [{ userId: 11n }, { userId: 12n }],
    });
    await expect(service.getMetrics()).resolves.toMatchObject({
      sharedNow: 3,
      shareOn30: 5,
      shareOff30: 2,
      clientOpens30: 8,
      clientOpeners30: 2,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        name: 'concept_shared',
        createdAt: { gte: SINCE },
        meta: { path: ['on'], equals: true },
      },
    });
    expect(conceptCount).toHaveBeenCalledWith({
      where: { sharedWithClientAt: { not: null } },
    });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['userId'],
      where: {
        name: 'client_concept_opened',
        createdAt: { gte: SINCE },
        userId: { not: null },
      },
    });
    const text = await service.render();
    expect(text).toContain('Схему случая сейчас видят клиенты: 3');
    expect(text).toContain('Клиенты смотрели свою схему 8 раз, клиентов: 2');
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
    expect(text).toContain('Собирали карту из концептуализации 5 раз');
    expect(text).toContain('Разворачивали схему на весь экран 4 раз');
    expect(text).not.toContain('Повторяли сохранение'); // 0 повторов — строки нет
    expect(text).toContain('Открывали 6 раз, терапевтов: 2');
    expect(text).toContain('Связи режимов заполняли 2 раз');
    expect(text).toContain('Убеждения и опыт схем записывали 3 раз');
  });
});
