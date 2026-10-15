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
// За рамками сознательно: scripts/check-*.mjs (33 однофайловых гейта обходят
// дерево через readdirSync+statSync без пропуска скрытых). В CI они идут
// отдельными шагами ПОСЛЕ jest или в джобе без кэша jest, а их спеки гоняют
// их в песочнице tmp, где `.jest-cache` нет, — конкурентной записи нет, гонки
// нет. Остаточный риск: ручной параллельный запуск гейтов при живом jest;
// запись в docs/README.md → «Что осталось открытым».
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

const ROOT = process.cwd();
const ALLOWED_WALKER = 'src/security/collect-source-files.ts';
const READ_DIR = /^(?:readdir|readdirSync|opendir|opendirSync)$/;
const STAT = /^(?:statSync|lstatSync|stat|lstat)$/;

type FnLike = ts.FunctionLikeDeclaration | ts.SourceFile;

const isFn = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n);

/** Имя вызываемого: `foo(` → foo, `a.b.foo(` → foo. */
function calleeName(call: ts.CallExpression): string | null {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

function nearestFn(node: ts.Node): FnLike {
  let p: ts.Node = node.parent;
  while (!isFn(p) && !ts.isSourceFile(p)) p = p.parent;
  return p;
}

/** Имя функции: декларация, метод или `const x = () => …`. */
function fnName(fn: FnLike): string | null {
  if (ts.isSourceFile(fn)) return null;
  if (fn.name && (ts.isIdentifier(fn.name) || ts.isPrivateIdentifier(fn.name)))
    return fn.name.text;
  const p = fn.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name))
    return p.name.text;
  if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name))
    return p.name.text;
  return null;
}

function hasRecursiveTrue(call: ts.CallExpression): boolean {
  return call.arguments.some(
    (a) =>
      ts.isObjectLiteralExpression(a) &&
      a.properties.some(
        (pr) =>
          ts.isPropertyAssignment(pr) &&
          pr.name.getText() === 'recursive' &&
          pr.initializer.kind === ts.SyntaxKind.TrueKeyword,
      ),
  );
}

const hasFnAncestor = (n: ts.Node, stop: ts.Node): boolean => {
  for (let p = n.parent; p && p !== stop; p = p.parent)
    if (isFn(p)) return true;
  return false;
};

interface Walk {
  line: number;
  reason: string;
}

/** Все вызовы чтения каталога в коде и причины, по которым они — обход. */
export function walkViolations(path: string, code: string): Walk[] {
  if (path === ALLOWED_WALKER) return [];
  const sf = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const calls: ts.CallExpression[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) calls.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);

  const out: Walk[] = [];
  for (const call of calls) {
    const name = calleeName(call);
    if (!name || !READ_DIR.test(name)) continue;
    const line = sf.getLineAndCharacterOfPosition(call.getStart()).line + 1;
    const scope = nearestFn(call);
    const reasons: string[] = [];
    if (hasRecursiveTrue(call)) reasons.push(`${name}(…, { recursive: true })`);
    const own = fnName(scope);
    const inScope = calls.filter(
      (c) =>
        (ts.isSourceFile(scope)
          ? !hasFnAncestor(c, scope)
          : c.pos >= scope.pos && c.end <= scope.end) && c !== call,
    );
    if (own && inScope.some((c) => calleeName(c) === own))
      reasons.push(`${own}() вызывает сама себя (ручная рекурсия)`);
    if (inScope.some((c) => STAT.test(calleeName(c) ?? '')))
      reasons.push('stat рядом с чтением каталога (гонка с кэшем jest)');
    for (const reason of reasons) out.push({ line, reason });
  }
  return out;
}

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
