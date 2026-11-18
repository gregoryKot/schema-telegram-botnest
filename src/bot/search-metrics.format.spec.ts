import { SEARCH_RESULT_KINDS } from '../analytics/cabinet-events.constants';
import {
  formatSearchMetrics,
  type SearchMetrics,
} from './search-metrics.format';

const metrics = (
  byKind: Partial<SearchMetrics['byKind30']> = {},
  typed30 = 0,
  recent30 = 0,
): SearchMetrics => ({
  byKind30: {
    ...(Object.fromEntries(
      SEARCH_RESULT_KINDS.map((k) => [k, 0]),
    ) as SearchMetrics['byKind30']),
    ...byKind,
  },
  typed30,
  recent30,
});

describe('formatSearchMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatSearchMetrics(metrics());
    expect(text).toContain('🔎 <b>Поиск</b> (за месяц)');
    expect(text).toContain('Через поиск пока ничего не открывали.');
    expect(text).not.toMatch(/NaN|undefined|— 0|: 0/);
  });

  it('сумма и разбивка по видам; нулевой вид и нулевой набор не показываются', () => {
    const text = formatSearchMetrics(metrics({ client: 4, guide: 3 }));
    expect(text).toContain(
      'Открыли результатов: 7 (клиентов — 4, листов справочника — 3)',
    );
    expect(text).not.toMatch(/разделов|действий|упражнений|набрав|недавнего/);
  });

  it('вкладки клиента и задания из справочника входят в сумму и в разбивку', () => {
    const text = formatSearchMetrics(metrics({ client_tab: 2, task: 5 }));
    expect(text).toContain(
      'Открыли результатов: 7 (вкладок клиента — 2, заданий из справочника — 5)',
    );
  });

  it('то, что открывает клиент, идёт после видов терапевта, в порядке списка', () => {
    const text = formatSearchMetrics(
      metrics({ own_task: 4, plan: 3, exercise: 2, pattern: 1, action: 5 }),
    );
    expect(text).toContain(
      'Открыли результатов: 15 (действий — 5, схем и режимов — 1, упражнений — 2, планов — 3, своих заданий — 4)',
    );
  });

  it('сколько открыто после набора запроса и из недавнего', () => {
    const text = formatSearchMetrics(
      metrics({ client: 1, section: 2, guide: 3, action: 4 }, 6, 2),
    );
    expect(text).toContain('Открыли результатов: 10');
    expect(text).toContain('Из них набрав запрос: 6');
    expect(text).toContain('Из них из недавнего: 2');
  });
});
