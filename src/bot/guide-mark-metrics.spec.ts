import {
  formatGuideMarkLine,
  getGuideMarkMetrics,
  withGuideExtras,
} from './guide-mark-metrics';

const none = {
  coping: 0,
  schema: 0,
  mode: 0,
  technique: 0,
  note: 0,
  concern: 0,
};

describe('formatGuideMarkLine', () => {
  it('пустая БД — человеческая строка без нулей', () => {
    expect(formatGuideMarkLine({ byKind: none, clients7: 0 })).toBe(
      'Отметки «Про клиента» за 7 дней: пока ни одной',
    );
  });

  it('всего, клиенты и виды по убыванию, нулевые виды не пишутся', () => {
    const byKind = { ...none, mode: 2, coping: 5, technique: 1 };
    expect(formatGuideMarkLine({ byKind, clients7: 3 })).toBe(
      'Отметки «Про клиента» за 7 дней: 8, клиентов — 3; ' +
        'чаще всего: копинги — 5, режимы — 2, техники — 1',
    );
  });

  it('клиентов не знаем (только копинги) — без «клиентов — 0»', () => {
    const byKind = { ...none, coping: 2 };
    expect(formatGuideMarkLine({ byKind, clients7: 0 })).toBe(
      'Отметки «Про клиента» за 7 дней: 2; чаще всего: копинги — 2',
    );
  });
});

describe('getGuideMarkMetrics / withGuideExtras', () => {
  type Where = { name: string; meta?: { equals: string } };
  type Ev = { userId: bigint | null; meta: unknown };
  const prisma = (
    kinds: Record<string, number>,
    pairs: number,
    coping: Ev[] = [],
  ) =>
    ({
      analyticsEvent: {
        findMany: () => Promise.resolve(coping),
        count: ({ where }: { where: Where }) =>
          Promise.resolve(
            where.name === 'guide_mark_added'
              ? (kinds[where.meta?.equals ?? ''] ?? 0)
              : 0,
          ),
        // Счётчики «готового ответа» (guide-answer-metrics): событий нет.
        groupBy: () => Promise.resolve([]),
      },
      guideMark: {
        groupBy: () =>
          Promise.resolve(
            Array.from({ length: pairs }, (_, i) => ({
              therapistId: 1n,
              clientId: BigInt(i + 1),
            })),
          ),
      },
    }) as never;

  it('вид — из meta.kind события, клиенты — пары из GuideMark', async () => {
    await expect(
      getGuideMarkMetrics(prisma({ mode: 4, note: 1 }, 2)),
    ).resolves.toEqual({
      byKind: { ...none, mode: 4, note: 1 },
      clients7: 2,
    });
  });

  it('клиенты копинга — из meta.clientId событий, без дублей с GuideMark', async () => {
    const coping: Ev[] = [
      { userId: 1n, meta: { kind: 'coping', clientId: '1' } }, // тот же клиент, что в GuideMark
      { userId: 1n, meta: { kind: 'coping', clientId: '9' } },
      { userId: 1n, meta: { kind: 'coping', clientId: '9' } },
      { userId: 1n, meta: { kind: 'coping' } }, // без клиента — не считается
    ];
    const m = await getGuideMarkMetrics(prisma({ coping: 4 }, 1, coping));
    expect(m.clients7).toBe(2);
  });

  it('строка дописана к блоку справочника', async () => {
    await expect(withGuideExtras(prisma({}, 0), 'блок')).resolves.toBe(
      'блок\nОтметки «Про клиента» за 7 дней: пока ни одной',
    );
  });
});
