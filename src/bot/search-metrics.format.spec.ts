import { formatSearchMetrics } from './search-metrics.format';

const EMPTY = {
  clients30: 0,
  tabs30: 0,
  sections30: 0,
  guide30: 0,
  tasks30: 0,
  actions30: 0,
  typed30: 0,
  recent30: 0,
};

describe('formatSearchMetrics', () => {
  it('пустая БД — человеческая строка, не 0/NaN/мусор', () => {
    const text = formatSearchMetrics(EMPTY);
    expect(text).toContain('🔎 <b>Поиск</b> (за месяц)');
    expect(text).toContain('Через поиск пока ничего не открывали.');
    expect(text).not.toMatch(/NaN|undefined|— 0|: 0/);
  });

  it('сумма и разбивка по видам; нулевой вид и нулевой набор не показываются', () => {
    const text = formatSearchMetrics({ ...EMPTY, clients30: 4, guide30: 3 });
    expect(text).toContain(
      'Открыли результатов: 7 (клиентов — 4, листов справочника — 3)',
    );
    expect(text).not.toMatch(/разделов|действий|набрав|недавнего/);
  });

  it('вкладки клиента и задания из справочника входят в сумму и в разбивку', () => {
    const text = formatSearchMetrics({ ...EMPTY, tabs30: 2, tasks30: 5 });
    expect(text).toContain(
      'Открыли результатов: 7 (вкладок клиента — 2, заданий из справочника — 5)',
    );
  });

  it('сколько открыто после набора запроса и из недавнего', () => {
    const text = formatSearchMetrics({
      ...EMPTY,
      clients30: 1,
      sections30: 2,
      guide30: 3,
      actions30: 4,
      typed30: 6,
      recent30: 2,
    });
    expect(text).toContain('Открыли результатов: 10');
    expect(text).toContain('Из них набрав запрос: 6');
    expect(text).toContain('Из них из недавнего: 2');
  });
});
