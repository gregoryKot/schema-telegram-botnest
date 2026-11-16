// Гейт: рекурсивный обход дерева исходников — только через collectSourceFiles
// (src/security/collect-source-files.ts). Флак CI 2026-10-15 (джоба backend,
// PR #680): `walk` в cron-source-scan.ts делал readdirSync + отдельный
// statSync, а внутри src/ живёт `.jest-cache/`, куда параллельные воркеры jest
// пишут и переименовывают временные файлы прямо во время обхода — файл исчезал
// между двумя вызовами, suite падал ENOENT мимо своей темы. Класс был
// «закрыт» в issue #215 (восемь копий walk), но спеки, родившиеся позже,
// написали обход заново — на main нашлись ещё четыре. Правило без гейта
// приезжает обратно (CLAUDE.md, №10/№11).
//
// Нарушение — вызов readdir/readdirSync/opendir/opendirSync в файле src/** или
// test/**, если:
//   а) в аргументах `recursive: true` (заходит в скрытые каталоги, и сам
//      порядок/окно гонки вне нашего контроля);
//   б) охватывающая функция вызывает саму себя (ручная рекурсия);
//   в) в охватывающей функции (включая вложенные колбэки) есть stat/lstat —
//      тип записи надо брать из `withFileTypes`, а не вторым системным вызовом.
// Плоское чтение одного каталога (`readdirSync(DIR).filter(...)`) законно.
// Единственный законный обходчик — collect-source-files.ts, исключён по пути;
// ALLOW-списка нет (правило №15: не замалчивать). Список файлов берётся из git,
// а не собственным обходом — иначе гейт сам стал бы нарушителем.
//
// scripts/check-*.mjs через collectSourceFiles не ходят: каждый гейт обязан
// быть самодостаточным (спеки гоняют его в песочнице tmp поодиночке). Зато
// рекурсивный обход в них обязан пропускать скрытые каталоги — `.jest-cache`
// и прочие кэши, — иначе ручной запуск гейта при живом jest падает на той же
// гонке удаления. Это держит второй describe ниже: статическая сверка всех
// гейтов + песочница на образцах каждой формы обхода.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { ALLOWED_WALKER, walkViolations } from './source-walk-rules';

const ROOT = process.cwd();

function trackedSources(): string[] {
  return execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      'src/*.ts',
      'test/*.ts',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  )
    .split('\n')
    .filter((f) => f && existsSync(join(ROOT, f)));
}

describe('обход дерева исходников — только через collectSourceFiles', () => {
  it('в src/** и test/** нет ручных обходов каталогов', () => {
    const found = trackedSources().flatMap((f) =>
      walkViolations(f, readFileSync(join(ROOT, f), 'utf8')).map(
        (v) => `${f}:${v.line}: ${v.reason}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('гейт не слеп: в репозитории есть вызовы readdirSync, и они разобраны', () => {
    const readers = trackedSources().filter((f) =>
      /\breaddirSync\(/.test(readFileSync(join(ROOT, f), 'utf8')),
    );
    expect(readers.length).toBeGreaterThanOrEqual(10);
    expect(readers).toContain(ALLOWED_WALKER);
  });

  describe('образцы: красные', () => {
    const reasons = (code: string) =>
      walkViolations('x.ts', code).map((v) => v.reason);

    it('прежний walk из cron-source-scan: readdir + stat + рекурсия', () => {
      const code = `
        function walk(dir: string, acc: string[] = []): string[] {
          for (const name of readdirSync(join(ROOT, dir))) {
            const rel = dir + '/' + name;
            if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, acc);
            else acc.push(rel);
          }
          return acc;
        }`;
      expect(reasons(code)).toEqual([
        'walk() вызывает сама себя (ручная рекурсия)',
        'stat рядом с чтением каталога (гонка с кэшем jest)',
      ]);
    });

    it('flatMap + statSync в колбэке (on-module-init-writes)', () => {
      const code = `
        function sourceFiles(dir: string): string[] {
          return readdirSync(dir).flatMap((name) =>
            statSync(join(dir, name)).isDirectory() ? [] : [name]);
        }`;
      expect(reasons(code)).toEqual([
        'stat рядом с чтением каталога (гонка с кэшем jest)',
      ]);
    });

    it('рекурсия через withFileTypes без stat (security-log-redact)', () => {
      const code = `
        function tsFiles(dir: string, out: string[] = []): string[] {
          for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (e.isDirectory()) tsFiles(join(dir, e.name), out);
            else out.push(e.name);
          }
          return out;
        }`;
      expect(reasons(code)).toEqual([
        'tsFiles() вызывает сама себя (ручная рекурсия)',
      ]);
    });

    it('стрелка в переменной, вызывающая сама себя', () => {
      const code = `
        const walk = (d: string): string[] =>
          readdirSync(d).flatMap((n) => walk(d + '/' + n));`;
      expect(reasons(code)).toEqual([
        'walk() вызывает сама себя (ручная рекурсия)',
      ]);
    });

    it.each([
      'readdirSync(root, { recursive: true })',
      'fs.readdirSync(root, { withFileTypes: true, recursive: true })',
      'await fs.promises.readdir(root, { recursive: true })',
    ])('recursive: true — %s', (call) => {
      expect(reasons(`const f = async () => ${call};`)).toEqual([
        expect.stringContaining('{ recursive: true }'),
      ]);
    });

    it('stat на уровне модуля рядом с readdir на уровне модуля', () => {
      const code = `const names = readdirSync(D); const st = statSync(D);`;
      expect(reasons(code)).toHaveLength(1);
    });
  });

  describe('образцы: зелёные', () => {
    const clean = (code: string) => walkViolations('x.ts', code);

    it('плоское чтение одного каталога', () => {
      const code = `const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));`;
      expect(clean(code)).toEqual([]);
    });

    it('чтение prisma/migrations с withFileTypes без рекурсии', () => {
      const code = `
        const dirs = readdirSync(join(ROOT, 'prisma', 'migrations'), { withFileTypes: true })
          .filter((e) => e.isDirectory());`;
      expect(clean(code)).toEqual([]);
    });

    it('recursive: false — не нарушение', () => {
      expect(clean(`readdirSync(d, { recursive: false });`)).toEqual([]);
    });

    it('statSync в ДРУГОЙ функции (права tmp-файла) законен', () => {
      const code = `
        const mode = (p: string) => statSync(p).mode & 0o777;
        function names(dir: string) { return readdirSync(dir); }`;
      expect(clean(code)).toEqual([]);
    });

    it('рекурсия не вокруг чтения каталога — не наша тема', () => {
      const code = `function fact(n: number): number { return n ? n * fact(n - 1) : 1; }`;
      expect(clean(code)).toEqual([]);
    });
  });

  describe('исключение не шире, чем нужно (правило №15 п.2)', () => {
    const walker = readFileSync(join(ROOT, ALLOWED_WALKER), 'utf8');

    it('collect-source-files.ts по своему пути не нарушает', () => {
      expect(walkViolations(ALLOWED_WALKER, walker)).toEqual([]);
    });

    it('тот же текст под другим путём краснеет (рекурсия без stat)', () => {
      const reasons = walkViolations('src/other-walker.ts', walker).map(
        (v) => v.reason,
      );
      expect(reasons).toEqual([
        'collectSourceFiles() вызывает сама себя (ручная рекурсия)',
      ]);
    });
  });
});

// Гейты-скрипты: рекурсия по каталогам — только с пропуском скрытых. Пропуск —
// `startsWith('.')` либо явный список кэшей (`\.jest-cache`…) там, где гейт
// обязан видеть скрытое (public-scripts: `public/.well-known` уходит в сайт).
const HIDDEN_SKIP = /startsWith\('\.'\)|\\\.jest-cache/;
// Ещё без пропуска — оба в docs/BACKLOG.md: telegram-chat-id ведёт пакет
// c3-11, dead-end-report выпал из аудита. Починил — убери из списка (тест
// «исключение не шире нужного» напомнит).
const NOT_YET = new Set([
  'check-telegram-chat-id.mjs',
  'check-dead-end-report.mjs',
]);
const RECURSION = /вызывает сама себя|recursive: true/;

describe('гейты scripts/check-*.mjs не заходят в скрытые каталоги', () => {
  const scriptsDir = join(ROOT, 'scripts');
  const gates = readdirSync(scriptsDir).filter((f) =>
    /^check-.*\.mjs$/.test(f),
  );
  const walkers = gates.filter((f) =>
    walkViolations(f, readFileSync(join(scriptsDir, f), 'utf8')).some((v) =>
      RECURSION.test(v.reason),
    ),
  );

  it('каждый рекурсивный обходчик пропускает скрытые каталоги', () => {
    const missing = walkers.filter(
      (f) =>
        !NOT_YET.has(f) &&
        !HIDDEN_SKIP.test(readFileSync(join(scriptsDir, f), 'utf8')),
    );
    expect(missing).toEqual([]);
  });

  it('исключение не шире нужного: каждый из NOT_YET ещё без пропуска', () => {
    const fixed = [...NOT_YET].filter(
      (f) =>
        !walkers.includes(f) ||
        HIDDEN_SKIP.test(readFileSync(join(scriptsDir, f), 'utf8')),
    );
    expect(fixed).toEqual([]);
  });

  it('сверка не слепа: обходчиков десятки, образцы ниже среди них', () => {
    expect(walkers.length).toBeGreaterThanOrEqual(30);
    expect(walkers).toEqual(
      expect.arrayContaining([
        'check-legacy-name.mjs',
        'check-route-collisions.mjs',
        'check-hover-only-reveal.mjs',
      ]),
    );
  });

  // Общий образец: одно и то же нарушение в скрытом каталоге гейт не читает,
  // а в обычном подкаталоге — ловит (контроль, что пропуск не шире нужного).
  const route = (ctrl: string) =>
    `@Controller('${ctrl}') class C { @Get('x') x() {} }\n`;
  const samples: Array<[string, (dir: string) => Record<string, string>]> = [
    [
      'check-legacy-name.mjs',
      (dir) => ({
        [`webapp/src/${dir}/x.ts`]: "export const t = 'СхемаЛаб';\n",
      }),
    ],
    [
      'check-route-collisions.mjs',
      (dir) => ({
        'src/a.controller.ts': route('a'),
        [`src/${dir}/b.controller.ts`]: route('a'),
      }),
    ],
    [
      'check-hover-only-reveal.mjs',
      (dir) => ({
        [`webapp/src/${dir}/a.css`]:
          '.x { opacity: 0; }\n.r:hover .x { opacity: 1; }\n',
      }),
    ],
  ];

  it.each(samples)(
    '%s: скрытый каталог с нарушением не читается',
    (gate, files) => {
      expect(runGate(gate, files('.jest-cache')).status).toBe(0);
      expect(runGate(gate, files('.vite')).status).toBe(0);
    },
  );

  it.each(samples)(
    '%s: то же нарушение в обычном каталоге — exit 1',
    (gate, files) => {
      expect(runGate(gate, files('cache')).status).toBe(1);
    },
  );
});
