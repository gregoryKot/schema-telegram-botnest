// Тест гейта check-recorded-fixtures.mjs (CLAUDE.md, правило №14: «тесты
// стояли по обе стороны шва, но не на шве»). Два из трёх последних
// инцидентов CalDAV (PR #491, PR #494) — один класс: парсер внешнего
// формата тестировался на фикстуре, которую выдумал сам автор кода, а не
// на том, что реально присылает площадка.
//
// Гейт НЕ ищет один признак «похоже на парсер» — он требует явной
// классификации каждого найденного парсера в
// scripts/recorded-fixtures-baseline.json (тот же принцип, что
// check-cron-leader.mjs применяет к `@Cron(`). Проверяются оба исхода
// (правило CLAUDE.md) плюс контрольные образцы (правило №15): похожий, но
// не подходящий случай обязан остаться незамеченным/красным, где уместно.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { loadRegexList } from './pattern-loader';

const REAL_BASELINE = join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'recorded-fixtures-baseline.json',
);

const CALDAV_SRC = [
  'export function isCalendarResource(x: string): boolean {',
  '  return /<calendar\\/?>/i.test(x);',
  '}',
  '',
].join('\n');

describe('check-recorded-fixtures.mjs', () => {
  it('чистое дерево: recorded с существующей фикстурой, упомянутой спеком, + exempt с нормальной причиной — exit 0', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'test/fixtures/recorded/icloud-calendar-tag.xml':
        '<C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/>\n',
      'src/booking/caldav-resourcetype.spec.ts': [
        "import { isCalendarResource } from './caldav-resourcetype';",
        '// грузит icloud-calendar-tag.xml',
        "it('ok', () => { expect(isCalendarResource('<calendar/>')).toBe(true); });",
        '',
      ].join('\n'),
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'recorded',
          fixtures: ['icloud-calendar-tag.xml'],
          spec: 'src/booking/caldav-resourcetype.spec.ts',
        },
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт recorded-fixtures');
  });

  it('явный путь (caldav-*.ts) без записи в бейслайне — exit 1, файл в отчёте', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('незаклассифицированные парсеры');
    expect(res.stderr).toContain('src/booking/caldav-resourcetype.ts');
  });

  // Ядро гейта: recorded, но фикстура на диске отсутствует.
  it('recorded со ссылкой на несуществующую фикстуру — exit 1', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'src/booking/caldav-resourcetype.spec.ts': "it('x', () => {});\n",
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'recorded',
          fixtures: ['nope.xml'],
          spec: 'src/booking/caldav-resourcetype.spec.ts',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'test/fixtures/recorded/nope.xml не существует',
    );
  });

  it('recorded — фикстура есть, но спек её не упоминает по имени — exit 1', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'test/fixtures/recorded/icloud-calendar-tag.xml': '<C:calendar/>\n',
      'src/booking/caldav-resourcetype.spec.ts': "it('x', () => {});\n",
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'recorded',
          fixtures: ['icloud-calendar-tag.xml'],
          spec: 'src/booking/caldav-resourcetype.spec.ts',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не упоминает фикстуру');
  });

  it('протухшая запись: файл-парсер исчез из кода — exit 1', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'exempt',
          reason: 'файла больше нет, но запись осталась в бейслайне',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи бейслайна');
    expect(res.stderr).toContain('src/booking/caldav-resourcetype.ts');
  });

  it('exempt с причиной короче 20 символов — exit 1', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'exempt',
          reason: 'коротко',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('причина короче 20 символов');
  });

  it('exempt с причиной-отпиской («legacy») — exit 1', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'exempt',
          reason: 'legacy, не трогаем этот код совсем',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('причина похожа на отписку');
  });

  it('неизвестный status — exit 1', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({
        'src/booking/caldav-resourcetype.ts': {
          status: 'maybe',
          reason: 'осознанная причина длиннее двадцати символов',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('неизвестный status «maybe»');
  });

  it('нет бейслайна вовсе — exit 1 с подсказкой', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('*.spec.ts и test-support/ не сканируются', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/booking/caldav-resourcetype.spec.ts': CALDAV_SRC,
      'src/test-support/caldav-resourcetype.ts': CALDAV_SRC,
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт recorded-fixtures: 0 парсеров');
  });

  // Content-эвристика: внешний вызов + разбор ответа — оба сигнала нужны
  // одновременно (контроль: только fetch без разбора ответа — НЕ кандидат,
  // иначе гейт ловил бы любой fetch в проекте, включая внутренние вызовы).
  it('content-эвристика: fetch( + .json() вместе — кандидат; один fetch( без разбора — нет', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/zoom.client.ts': [
        'export async function callZoom() {',
        "  const res = await fetch('https://api.zoom.us/x');",
        '  return (await res.json()) as unknown;',
        '}',
        '',
      ].join('\n'),
      'src/internal.notify.ts': [
        'export async function ping() {',
        "  await fetch('https://internal.example/ping');",
        '}',
        '',
      ].join('\n'),
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/zoom.client.ts');
    expect(res.stderr).not.toContain('src/internal.notify.ts');
  });

  // Content-эвристика: подпись/токен внешнего формата — самостоятельный
  // сигнал, не требующий соседнего fetch( (initData/JWT приходят снаружи,
  // а не запрашиваются нашим кодом).
  it('content-эвристика: createHmac( без fetch( рядом — всё равно кандидат', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/verify-widget.ts': [
        "import { createHmac } from 'crypto';",
        'export function verify(s: string, secret: Buffer) {',
        "  return createHmac('sha256', secret).update(s).digest('hex');",
        '}',
        '',
      ].join('\n'),
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/verify-widget.ts');
  });

  // Явный путь: providers/registry.ts и providers/types.ts — контрольный
  // образец границы паттерна (чистая инфраструктура/типы, не парсер сами
  // по себе; см. scripts/recorded-fixtures-patterns.mjs).
  it('явный путь: providers/registry.ts и providers/types.ts исключены из паттерна', () => {
    const res = runGate('check-recorded-fixtures.mjs', {
      'src/auth/providers/registry.ts': 'export const x = 1;\n',
      'src/auth/providers/types.ts': 'export type X = number;\n',
      'src/auth/providers/vk.provider.ts': 'export const y = 1;\n',
      'scripts/recorded-fixtures-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/auth/providers/vk.provider.ts');
    expect(res.stderr).not.toContain('src/auth/providers/registry.ts');
    expect(res.stderr).not.toContain('src/auth/providers/types.ts');
  });

  it('--verbose печатает найденных кандидатов с классификацией [path]/[content]', () => {
    const res = runGate(
      'check-recorded-fixtures.mjs',
      {
        'src/booking/caldav-resourcetype.ts': CALDAV_SRC,
        'src/booking/caldav-resourcetype.spec.ts':
          "// грузит icloud-calendar-tag.xml\nit('x', () => {});\n",
        'test/fixtures/recorded/icloud-calendar-tag.xml': '<C:calendar/>\n',
        'scripts/recorded-fixtures-baseline.json': JSON.stringify({
          'src/booking/caldav-resourcetype.ts': {
            status: 'recorded',
            fixtures: ['icloud-calendar-tag.xml'],
            spec: 'src/booking/caldav-resourcetype.spec.ts',
          },
        }),
      },
      { args: ['--verbose'] },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('src/booking/caldav-resourcetype.ts  [path]');
  });
});

// Реестр scripts/recorded-fixtures-baseline.json — держим честным сам по
// себе (тот же принцип, что cron-leader.spec.ts/feature-parity.spec.ts
// применяют к своим бейслайнам): каждая запись валидна, ключи отсортированы
// (правило №13 CLAUDE.md), у recorded — существующие фикстуры и спек,
// у exempt — причина не короче 20 символов и без слов-отписок.
describe('scripts/recorded-fixtures-baseline.json соответствует своим правилам', () => {
  const RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

  it('каждая запись валидна, ключи отсортированы', () => {
    const baseline = JSON.parse(readFileSync(REAL_BASELINE, 'utf8')) as Record<
      string,
      { status: string; reason?: string; fixtures?: string[]; spec?: string }
    >;
    const keys = Object.keys(baseline);
    expect(keys).toEqual([...keys].sort());
    for (const [key, v] of Object.entries(baseline)) {
      expect(['recorded', 'exempt']).toContain(v.status);
      if (v.status === 'exempt') {
        const reason = (v.reason ?? '').trim();
        if (reason.length < 20) throw new Error(`${key}: reason too short`);
        const lower = reason.toLowerCase();
        for (const flag of RED_FLAGS) {
          if (lower.includes(flag)) throw new Error(`${key}: reason «${flag}»`);
        }
      } else {
        expect(Array.isArray(v.fixtures) && v.fixtures.length > 0).toBe(true);
        expect(typeof v.spec).toBe('string');
      }
    }
  });
});

// Правило №10: движок check-recorded-fixtures.mjs раздроблен на движок +
// модуль правил recorded-fixtures-patterns.mjs. check-unwatched-code.mjs
// требует, чтобы у каждого исполняемого файла в scripts/ был тест, упоминающий
// его по имени (не в комментарии) — движок упомянут через runGate() выше, эта
// проверка закрывает вторую половину дробления и пинит сами правила образцом
// и контрольным образцом (правило №15: исключение не шире, чем нужно).
describe('дробление движок + модуль правил', () => {
  const REAL_SCRIPTS_DIR = join(__dirname, '..', '..', '..', 'scripts');

  it('check-recorded-fixtures.mjs импортирует recorded-fixtures-patterns.mjs', () => {
    const engineSrc = readFileSync(
      join(REAL_SCRIPTS_DIR, 'check-recorded-fixtures.mjs'),
      'utf8',
    );
    expect(engineSrc).toContain("from './recorded-fixtures-patterns.mjs'");
  });

  it('явные пути ловят парсеры площадок и не ловят реестр/типы провайдеров', () => {
    const patterns = loadRegexList(
      'recorded-fixtures-patterns.mjs',
      'PARSER_PATH_PATTERNS',
    ).map((r) => new RegExp(r.source, r.flags));
    const matches = (p: string) => patterns.some((re) => re.test(p));
    // Образцы: то, что гейт обязан видеть.
    expect(matches('src/booking/caldav-discovery.ts')).toBe(true);
    expect(matches('src/auth/max-init-data.ts')).toBe(true);
    expect(matches('src/auth/providers/google.provider.ts')).toBe(true);
    expect(matches('src/channel/targets/vk.target.ts')).toBe(true);
    expect(matches('src/booking/robokassa.service.ts')).toBe(true);
    // Контроль: реестр и типы провайдеров — не парсеры; соседний сервис без
    // внешнего формата гейт по пути не трогает.
    expect(matches('src/auth/providers/registry.ts')).toBe(false);
    expect(matches('src/auth/providers/types.ts')).toBe(false);
    expect(matches('src/booking/pricing.service.ts')).toBe(false);
  });
});
