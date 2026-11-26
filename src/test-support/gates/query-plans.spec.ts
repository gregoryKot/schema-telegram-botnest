// Тест гейта check-query-plans.mjs — планы горячих запросов на синтетике.
//
// Гейт судит отчёт замера (test/perf/run-plans.ts): Seq Scan по большой
// таблице с большим отбросом строк, повторный полный проход внутри цикла,
// храповик по страницам, грубый потолок времени. Сам замер требует живого
// Postgres, а СУЖДЕНИЕ — чистая функция от JSON, и проверяется здесь без базы.
//
// Проверяются оба исхода (сломанный гейт не краснеет — он молча пропускает
// всё) плюс контрольные образцы к каждому исключению (правило №15 п.2):
// похожий, но незаконный случай обязан остаться красным. Отдельно пинится
// самый тихий способ сломать защиту: замер, снятый на пустой базе, —
// нарушений в нём нет никогда.
import { readFileSync } from 'fs';
import { join } from 'path';
import { cleanupTmp, runGate } from './gate-sandbox';

/** Таблицы синтетики: размеры как в профиле «горизонт роста» (test/perf/seed.ts). */
const TABLE_ROWS = {
  Rating: 1_500_000,
  AnalyticsEvent: 2_000_000,
  TherapyRelation: 10_500,
  BookingSetting: 1,
};

const indexScan = (over: Record<string, unknown> = {}) => ({
  sql: 'SELECT "value" FROM "Rating" WHERE "userId" = $1 AND "date" = $2',
  calls: 1,
  ms: 2,
  blocks: 40,
  seqScans: [],
  ...over,
});

/** Seq Scan, который прочитал всю таблицу и почти всё выбросил = нет индекса. */
const wastefulSeqScan = (table = 'AnalyticsEvent', over = {}) => ({
  sql: `SELECT count(*) FROM "${table}" WHERE "createdAt" >= $1`,
  calls: 1,
  ms: 900,
  blocks: 18_000,
  seqScans: [{ table, kept: 2_000, removed: 1_998_000, loops: 1 }],
  ...over,
});

const report = (
  statements: unknown[],
  over: Record<string, unknown> = {},
  tableRows: Record<string, number> = TABLE_ROWS,
) =>
  JSON.stringify({
    measuredAt: '2026-10-08T00:00:00.000Z',
    tableRows,
    scenarios: [
      {
        name: 'stats-report',
        title: 'Админский отчёт /stats',
        ms: 1_200,
        blocks: 50_000,
        statements,
        ...over,
      },
    ],
  });

const baseline = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    scenarios: { 'stats-report': { blocks: 50_000, msCeiling: 4_000 } },
    seqScanAllowed: {},
    ...over,
  });

function run(files: Record<string, string>, args: string[] = []) {
  return runGate('check-query-plans.mjs', files, { args });
}

describe('check-query-plans.mjs', () => {
  it('чистый замер: индексные планы в рамках планки — exit 0', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Планы запросов в норме');
  });

  it('Seq Scan по большой таблице, выбросивший 99% прочитанного — exit 1 с именем таблицы', () => {
    const res = run({
      '.perf/plans.json': report([wastefulSeqScan()]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('AnalyticsEvent');
    expect(res.stderr).toContain('нет индекса под этот фильтр');
  });

  it('тот же Seq Scan по МАЛЕНЬКОЙ таблице — exit 0: порог размера осознанный, а не «лишь бы зелено»', () => {
    const res = run({
      '.perf/plans.json': report([
        wastefulSeqScan('BookingSetting', {
          seqScans: [
            { table: 'BookingSetting', kept: 1, removed: 999, loops: 1 },
          ],
        }),
      ]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('Seq Scan, отдавший почти всё прочитанное (агрегат по всей таблице) — exit 0', () => {
    const res = run({
      '.perf/plans.json': report([
        wastefulSeqScan('Rating', {
          seqScans: [
            { table: 'Rating', kept: 1_500_000, removed: 0, loops: 1 },
          ],
        }),
      ]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('повторный полный проход внутри цикла — exit 1 даже без отброса строк', () => {
    const res = run({
      '.perf/plans.json': report([
        wastefulSeqScan('Rating', {
          seqScans: [
            {
              table: 'Rating',
              kept: 1_500_000,
              removed: 0,
              loops: 50,
              parallel: false,
            },
          ],
        }),
      ]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('повторён 50 раз');
  });

  // Контрольный образец к предыдущему: у ПАРАЛЛЕЛЬНОГО скана loops — это
  // воркеры, поделившие один проход. Ругаться на это значило бы краснеть на
  // оптимизацию планировщика (и так и было, пока замер не различал эти два
  // случая, — поймано прогоном на живой базе).
  it('параллельный скан без отброса строк — exit 0: воркеры это не повторы', () => {
    const res = run({
      '.perf/plans.json': report([
        wastefulSeqScan('Rating', {
          seqScans: [
            {
              table: 'Rating',
              kept: 1_500_000,
              removed: 0,
              loops: 3,
              parallel: true,
            },
          ],
        }),
      ]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('параллельный скан, выбросивший почти всё — exit 1: отбор судится как обычно', () => {
    const res = run({
      '.perf/plans.json': report([
        wastefulSeqScan('AnalyticsEvent', {
          seqScans: [
            {
              table: 'AnalyticsEvent',
              kept: 37_000,
              removed: 1_963_000,
              loops: 3,
              parallel: true,
            },
          ],
        }),
      ]),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('нет индекса под этот фильтр');
  });

  it('исключение с честной причиной гасит нарушение — exit 0', () => {
    const res = run({
      '.perf/plans.json': report([wastefulSeqScan()]),
      'scripts/query-plan-baseline.json': baseline({
        seqScanAllowed: {
          'stats-report:AnalyticsEvent':
            'окно 30 дней покрывает треть таблицы, индекс проигрывает чтению',
        },
      }),
    });
    expect(res.status).toBe(0);
  });

  it('контрольный образец: исключение с причиной-отпиской не гасит — exit 1', () => {
    const res = run({
      '.perf/plans.json': report([wastefulSeqScan()]),
      'scripts/query-plan-baseline.json': baseline({
        seqScanAllowed: {
          'stats-report:AnalyticsEvent':
            'legacy-отчёт, разберёмся с индексом как-нибудь потом',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('причина-отписка');
  });

  it('контрольный образец: исключение с причиной в два слова не гасит — exit 1', () => {
    const res = run({
      '.perf/plans.json': report([wastefulSeqScan()]),
      'scripts/query-plan-baseline.json': baseline({
        seqScanAllowed: { 'stats-report:AnalyticsEvent': 'так надо' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('причина короче');
  });

  it('протухшее исключение (гасить больше нечего) — exit 1', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()]),
      'scripts/query-plan-baseline.json': baseline({
        seqScanAllowed: {
          'stats-report:AnalyticsEvent':
            'окно 30 дней покрывает треть таблицы, индекс проигрывает чтению',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('больше ничего не гасит');
  });

  it('страниц стало кратно больше планки — exit 1', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()], { blocks: 150_000 }),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('против планки');
  });

  it('рост страниц внутри допуска — exit 0: допуск осознанный, иначе гейт ложно-красный', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()], { blocks: 55_000 }),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('время выше потолка — exit 1', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()], { ms: 9_000 }),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('выше потолка');
  });

  it('потолок времени не поставлен — exit 1: --update его не придумывает', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()]),
      'scripts/query-plan-baseline.json': JSON.stringify({
        scenarios: { 'stats-report': { blocks: 50_000 } },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('msCeiling');
  });

  it('новый сценарий без планки — exit 1, а не молчаливый пропуск', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()]),
      'scripts/query-plan-baseline.json': JSON.stringify({ scenarios: {} }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не заведён в бейслайне');
  });

  it('сценарий есть в бейслайне, но пропал из замера — exit 1', () => {
    const res = run({
      '.perf/plans.json': JSON.stringify({
        tableRows: TABLE_ROWS,
        scenarios: [],
      }),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не в замере');
  });

  it('отчёта замера нет — exit 1: «нечего проверять» не равно «всё хорошо»', () => {
    const res = run({ 'scripts/query-plan-baseline.json': baseline() });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('отчёта замера нет');
  });

  it('замер снят на пустой базе — exit 1: иначе гейт зелен всегда и молча', () => {
    const res = run({
      '.perf/plans.json': report([indexScan()], {}, { Rating: 120 }),
      'scripts/query-plan-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не на синтетике');
  });

  it('--update фиксирует страницы и НЕ трогает поставленный руками потолок', () => {
    const res = runGate(
      'check-query-plans.mjs',
      {
        '.perf/plans.json': report([indexScan()], { blocks: 31_000 }),
        'scripts/query-plan-baseline.json': baseline(),
      },
      { args: ['--update'], keepTmp: true },
    );
    try {
      expect(res.status).toBe(0);
      const written = JSON.parse(
        readFileSync(
          join(res.tmp, 'scripts', 'query-plan-baseline.json'),
          'utf8',
        ),
      ) as { scenarios: Record<string, { blocks: number; msCeiling: number }> };
      expect(written.scenarios['stats-report'].blocks).toBe(31_000);
      expect(written.scenarios['stats-report'].msCeiling).toBe(4_000);
    } finally {
      cleanupTmp(res.tmp);
    }
  });
});
