// Инвариант аудита 2026-10 (кластер 9): сырой SQL не читает «сейчас» у
// сервера БД. Колонки проекта — `timestamp without time zone` (в схеме ни
// одного Timestamptz), поэтому `now()` / `CURRENT_DATE` / `LOCALTIMESTAMP` в
// запросе неявно зависят от TimeZone сессии Postgres: под Australia/Sydney
// когорта D1 в /stats уезжала на пользователя. На проде сегодня UTC — это
// допущение о конфиге, которое никто не сверяет. Время приходит параметром из
// Node (`${new Date(...)}`): адаптер pg отдаёт его UTC-строкой без зоны, и
// сравнение от зоны сессии не зависит.
//
// Проверка идёт по AST: проверяется только текст сырого SQL (шаблон за тегом
// $queryRaw / $executeRaw / Prisma.sql и строковые аргументы *Unsafe). JS-вызов
// `this.now()` в probe-*.ts или слово now() в комментарии — не SQL (правило
// №15: ложно-красный гейт отключают). Рождается с нулём нарушений, без ALLOW.
import { readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import * as ts from 'typescript';
import { collectSourceFiles } from '../../security/collect-source-files';

const SRC = join(__dirname, '..', '..');

const RAW_TAGS = new Set(['$queryRaw', '$executeRaw', 'sql']);
const RAW_UNSAFE = new Set(['$queryRawUnsafe', '$executeRawUnsafe']);

const DB_CLOCK =
  /\bnow\s*\(\s*\)|\bCURRENT_(?:DATE|TIMESTAMP|TIME)\b|\bLOCAL(?:TIMESTAMP|TIME)\b|\b(?:clock|statement|transaction)_timestamp\b/i;

function sourceFiles(dir: string): string[] {
  return collectSourceFiles(dir, {
    filter: (p) => !relative(dir, p).split(sep).includes('test-support'),
  });
}

/** Статические куски SQL-шаблона (без значений `${…}`). */
function templateText(t: ts.TemplateLiteral): string {
  return ts.isNoSubstitutionTemplateLiteral(t)
    ? t.text
    : [t.head.text, ...t.templateSpans.map((s) => s.literal.text)].join(' ');
}

/** Серверные «сейчас» в тексте сырого SQL: строки вида `файл:строка: now()`. */
function violations(code: string): string[] {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const check = (node: ts.Node, text: string) => {
    const m = DB_CLOCK.exec(text);
    if (m) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      found.push(`${line}: ${m[0]}`);
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag;
      const name = ts.isPropertyAccessExpression(tag)
        ? tag.name.text
        : ts.isIdentifier(tag)
          ? tag.text
          : '';
      if (RAW_TAGS.has(name)) {
        check(node, templateText(node.template));
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      RAW_UNSAFE.has(node.expression.name.text)
    ) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteralLike(first)) check(first, first.text);
      else if (first && ts.isTemplateExpression(first)) {
        check(first, templateText(first));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('сырой SQL не читает часы сервера БД', () => {
  it('в src/** нет now() / CURRENT_* / LOCALTIMESTAMP в $queryRaw, $executeRaw, Prisma.sql, *Unsafe', () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      violations(readFileSync(file, 'utf8')).map(
        (v) => `${relative(SRC, file)}:${v}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('сканер видит сырой SQL (иначе проверка ничего не доказывает)', () => {
    const withRaw = sourceFiles(SRC)
      .filter((f) =>
        /\$(?:queryRaw|executeRaw)\b/.test(readFileSync(f, 'utf8')),
      )
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(withRaw).toEqual(
      expect.arrayContaining(['bot/bot.admin-stats.service.ts']),
    );
  });

  describe('контрольные образцы', () => {
    it('прежний предикат когорты D1 краснеет', () => {
      const old = `class S { f(n: number) { return this.prisma.$queryRaw\`
        SELECT 1 FROM "User" u
        WHERE u."createdAt" >= now() - make_interval(days => \${n + 7})\`; } }`;
      expect(violations(old)).toEqual(['1: now()']);
    });

    it.each([
      'CURRENT_TIMESTAMP',
      'current_date',
      'LOCALTIMESTAMP',
      'clock_timestamp()',
    ])('%s в $executeRaw краснеет', (fn) => {
      const code = `class S { f() { return this.p.$executeRaw\`UPDATE "T" SET "x" = ${fn} WHERE "at" < 1\`; } }`;
      expect(violations(code)).toHaveLength(1);
    });

    it('now() в строке $queryRawUnsafe краснеет', () => {
      const code = `class S { f() { return this.p.$queryRawUnsafe('SELECT now()'); } }`;
      expect(violations(code)).toEqual(['1: now()']);
    });

    it('now() в Prisma.sql краснеет', () => {
      const code = 'const q = Prisma.sql`SELECT 1 WHERE a < now()`;';
      expect(violations(code)).toEqual(['1: now()']);
    });

    it('время параметром из Node законно', () => {
      const code = `class S { f(d: Date) { return this.p.$queryRaw\`SELECT 1 WHERE a < \${d}\`; } }`;
      expect(violations(code)).toEqual([]);
    });

    it('JS-вызов now() и Date.now() вне SQL законны', () => {
      const code = `class S { private now() { return new Date(); }
        f() { const n = this.now(); return Date.now() - n.getTime(); } }`;
      expect(violations(code)).toEqual([]);
    });

    it('now() в комментарии рядом с сырым SQL законно', () => {
      const code = `class S { f(d: Date) {
        // раньше было now() - interval
        return this.p.$queryRaw\`SELECT 1 WHERE a < \${d}\`; } }`;
      expect(violations(code)).toEqual([]);
    });

    it('идентификатор вроде snow() или name now в тексте SQL не путается', () => {
      const code = 'const q = Prisma.sql`SELECT "known_now" FROM t`;';
      expect(violations(code)).toEqual([]);
    });
  });
});
