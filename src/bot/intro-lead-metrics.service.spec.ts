// Агрегат блока «Заявки с формы знакомства»: три count по Prisma (без сырого
// SQL). Разные where — разные ответы мока, поэтому перепутанный фильтр виден.
import { IntroLeadMetricsService } from './intro-lead-metrics.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const WEEK_AGO = new Date('2026-10-08T12:00:00.000Z');

function build(answers: {
  week?: number;
  weekLost?: number;
  olderLost?: number;
}) {
  const count = jest.fn(
    async (args: {
      where: {
        createdAt: { gte?: Date; lt?: Date };
        anonymizedAt?: null;
        tgDeliveredAt?: null;
      };
    }) => {
      if (args.where.createdAt.lt) return answers.olderLost ?? 0;
      return args.where.tgDeliveredAt === null
        ? (answers.weekLost ?? 0)
        : (answers.week ?? 0);
    },
  );
  return {
    count,
    service: new IntroLeadMetricsService({ introLead: { count } } as never),
  };
}

describe('IntroLeadMetricsService', () => {
  it('раскладывает счётчики: за неделю, из них недошедшие, старые недошедшие', async () => {
    const { service } = build({ week: 5, weekLost: 2, olderLost: 1 });
    await expect(service.getMetrics(NOW)).resolves.toEqual({
      week: 5,
      weekLost: 2,
      olderLost: 1,
    });
  });

  it('фильтры: неделя — createdAt >= 7 дней назад; недошедшие — оба флага null; старые — ещё и не обезличены', async () => {
    const { service, count } = build({});
    await service.getMetrics(NOW);
    expect(count).toHaveBeenCalledWith({
      where: { createdAt: { gte: WEEK_AGO } },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: WEEK_AGO },
        tgDeliveredAt: null,
        emailDeliveredAt: null,
      },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: WEEK_AGO },
        anonymizedAt: null,
        tgDeliveredAt: null,
        emailDeliveredAt: null,
      },
    });
  });

  it('render(): пустая база — текст без цифр-нулей', async () => {
    const { service } = build({});
    await expect(service.render()).resolves.toContain(
      'За неделю заявок не было.',
    );
  });

  it('render(): ненулевое — готовый блок', async () => {
    const { service } = build({ week: 3, weekLost: 3 });
    await expect(service.render()).resolves.toContain(
      'не дошли ни в бот, ни на почту: 3',
    );
  });
});
