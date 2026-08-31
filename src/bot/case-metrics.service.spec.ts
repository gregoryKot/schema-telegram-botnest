/**
 * Агрегат разбора случая для /stats.
 *
 * Prisma мокается; проверяем ровно то, что легко ломается молча в сыром SQL:
 * маппинг bigint→number, разбор булева `agreed` из JSON (Postgres отдаёт его
 * строкой 'true'/'false', а не булевым), и подсчёт вернувшихся ПО ЛЮДЯМ —
 * один человек с пятью разборами не должен выглядеть как пятеро вернувшихся.
 *
 * Отдельно закреплено пустое состояние: на чистой базе агрегат обязан отдать
 * нули, а не undefined/NaN, иначе форматтер отчёта покажет мусор.
 */
import { CaseMetricsService } from './case-metrics.service';

type MetaRow = { value: string | null; c: bigint };

describe('CaseMetricsService.getMetrics', () => {
  /**
   * Порядок моков совпадает с Promise.all в сервисе: два count, четыре
   * $queryRaw по мете, затем два $queryRaw по людям.
   */
  const build = (opts: {
    started: number;
    finished: number;
    scene: MetaRow[];
    verdict: MetaRow[];
    recognized: MetaRow[];
    named: MetaRow[];
    people: bigint;
    returned: bigint;
  }) => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(opts.started)
      .mockResolvedValueOnce(opts.finished);
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce(opts.scene)
      .mockResolvedValueOnce(opts.verdict)
      .mockResolvedValueOnce(opts.recognized)
      .mockResolvedValueOnce(opts.named)
      .mockResolvedValueOnce([{ c: opts.people }])
      .mockResolvedValueOnce([{ c: opts.returned }]);
    const prisma = {
      analyticsEvent: { count },
      $queryRaw: queryRaw,
    } as never;
    return { service: new CaseMetricsService(prisma), count, queryRaw };
  };

  const FULL = {
    started: 40,
    finished: 31,
    scene: [
      { value: 'own', c: 25n },
      { value: 'frame', c: 15n },
    ],
    verdict: [
      { value: 'mode', c: 22n },
      { value: 'ordinary', c: 6n },
      { value: 'borderline', c: 3n },
    ],
    recognized: [
      { value: 'true', c: 20n },
      { value: 'false', c: 11n },
    ],
    named: [
      { value: 'own', c: 14n },
      { value: 'chip', c: 9n },
      { value: 'skipped', c: 8n },
    ],
    people: 27n,
    returned: 9n,
  };

  it('раскладывает воронку, сцену, вердикты и имена', async () => {
    const { service } = build(FULL);
    const m = await service.getMetrics();
    expect(m.started).toBe(40);
    expect(m.finished).toBe(31);
    expect(m.sceneOwn).toBe(25);
    expect(m.sceneFrame).toBe(15);
    expect(m.verdictMode).toBe(22);
    expect(m.verdictOrdinary).toBe(6);
    expect(m.verdictBorderline).toBe(3);
    expect(m.namedOwn).toBe(14);
    expect(m.namedChip).toBe(9);
    expect(m.namedSkipped).toBe(8);
  });

  it('читает булево «согласился» как строку JSON, а не как boolean', async () => {
    // meta->>'agreed' в Postgres отдаёт 'true'/'false'; если читать булево,
    // обе доли молча станут нулями и индикатор Барнума перестанет работать.
    const { service } = build(FULL);
    const m = await service.getMetrics();
    expect(m.recognizedAgreed).toBe(20);
    expect(m.recognizedDoubted).toBe(11);
  });

  it('переводит bigint в number — иначе отчёт падает на сериализации', async () => {
    const { service } = build(FULL);
    const m = await service.getMetrics();
    expect(m.people).toBe(27);
    expect(m.peopleReturned).toBe(9);
    expect(typeof m.people).toBe('number');
    expect(typeof m.peopleReturned).toBe('number');
  });

  it('на чистой базе отдаёт нули, а не undefined', async () => {
    const { service } = build({
      started: 0,
      finished: 0,
      scene: [],
      verdict: [],
      recognized: [],
      named: [],
      people: 0n,
      returned: 0n,
    });
    const m = await service.getMetrics();
    for (const value of Object.values(m)) {
      expect(typeof value).toBe('number');
      expect(Number.isNaN(value)).toBe(false);
    }
    expect(m.started).toBe(0);
    expect(m.people).toBe(0);
  });

  it('пустой ответ по людям не роняет агрегат', async () => {
    const { service, queryRaw } = build(FULL);
    queryRaw
      .mockReset()
      .mockResolvedValueOnce(FULL.scene)
      .mockResolvedValueOnce(FULL.verdict)
      .mockResolvedValueOnce(FULL.recognized)
      .mockResolvedValueOnce(FULL.named)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const m = await service.getMetrics();
    expect(m.people).toBe(0);
    expect(m.peopleReturned).toBe(0);
  });

  it('незнакомое значение меты не попадает ни в одну строку отчёта', async () => {
    const { service } = build({
      ...FULL,
      verdict: [
        { value: 'mode', c: 5n },
        { value: 'придуманное', c: 99n },
        { value: null, c: 7n },
      ],
    });
    const m = await service.getMetrics();
    expect(m.verdictMode).toBe(5);
    expect(m.verdictOrdinary).toBe(0);
    expect(m.verdictBorderline).toBe(0);
  });

  it('считает события только двух нужных имён', async () => {
    const { service, count } = build(FULL);
    await service.getMetrics();
    expect(count).toHaveBeenCalledTimes(2);
    const names = count.mock.calls.map((c) => c[0].where.name);
    expect(names).toEqual(['case_started', 'case_finished']);
  });
});
