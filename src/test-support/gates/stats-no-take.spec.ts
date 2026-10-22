// Инвариант аудита 2026-10: отчёт /stats считает агрегаты, а не обрезанную
// выборку. `rating.findMany({ distinct: ['userId','date'], take: 5000 })`
// Prisma исполняет как ORDER BY id без LIMIT, дедуплицирует в памяти и
// оставляет первые 5000 — то есть самые старые пары. Выше ~170 человек в день
// свежие дни выпадали, и «Ведут дневник регулярно» показывало 0 из 300
// (доказательство на живой базе — test/raw-sql-live-admin-stats.e2e-spec.ts).
//
// Класс живёт не в одном файле: «страховка от роста таблицы» через take
// выглядит заботливо и переезжает копией в соседний блок. Поэтому пин
// смотрит на все файлы отчёта — src/bot/*metrics*, *stats*, stats-report* —
// и краснеет на:
//   - `distinct` вместе с `take` в одном вызове: счёт по обрезанному
//     множеству неверен при любом orderBy;
//   - `take` без `orderBy`: какие строки останутся, решает не код.
// Список «последние N событий» с orderBy законен — контрольный образец ниже.
// ALLOW нет: сегодня класс вычищен целиком.
import { readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import * as ts from 'typescript';
import { collectSourceFiles } from '../../security/collect-source-files';

const SRC = join(__dirname, '..', '..');
const REPORT_FILE = /^bot\/[^/]*(metrics|stats)[^/]*\.ts$/;

function reportFiles(): string[] {
  return collectSourceFiles(join(SRC, 'bot'))
    .map((f) => relative(SRC, f).split(sep).join('/'))
    .filter((f) => REPORT_FILE.test(f));
}

function propNames(obj: ts.ObjectLiteralExpression): Set<string> {
  const names = new Set<string>();
  for (const p of obj.properties) {
    if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      names.add(p.name.text);
    }
  }
  return names;
}

/** Нарушения в тексте файла: строки вида `строка: причина`. */
function violations(code: string): string[] {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const arg = node.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        const names = propNames(arg);
        const line =
          sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        if (names.has('take') && names.has('distinct')) {
          found.push(`${line}: distinct + take`);
        } else if (names.has('take') && !names.has('orderBy')) {
          found.push(`${line}: take без orderBy`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('отчёт /stats не считает по обрезанной выборке', () => {
  it('в файлах отчёта нет distinct+take и take без orderBy', () => {
    const found = reportFiles().flatMap((f) =>
      violations(readFileSync(join(SRC, f), 'utf8')).map((v) => `${f}:${v}`),
    );
    expect(found).toEqual([]);
  });

  it('сканер видит файлы отчёта (иначе проверка ничего не доказывает)', () => {
    const files = reportFiles();
    expect(files).toEqual(
      expect.arrayContaining([
        'bot/bot.admin-stats.service.ts',
        'bot/bot.product-metrics.service.ts',
        'bot/stats-report.service.ts',
      ]),
    );
    expect(files.some((f) => f.endsWith('.spec.ts'))).toBe(false);
  });

  describe('контрольные образцы', () => {
    it('прежний подсчёт «ядра» (distinct + take) краснеет', () => {
      const old = `class S { f(d30: string) { return this.prisma.rating.findMany({
        where: { date: { gte: d30 } },
        select: { date: true, userId: true },
        distinct: ['userId', 'date'],
        take: 5000,
      }); } }`;
      expect(violations(old)).toEqual(['1: distinct + take']);
    });

    it('distinct + take краснеет и с orderBy: счёт по урезанному множеству неверен', () => {
      const code = `f({ distinct: ['userId'], orderBy: { date: 'desc' }, take: 5000 })`;
      expect(violations(code)).toEqual(['1: distinct + take']);
    });

    it('take без orderBy краснеет', () => {
      expect(violations(`p.user.findMany({ take: 10 })`)).toEqual([
        '1: take без orderBy',
      ]);
    });

    it('«последние N» с orderBy и без distinct — законно', () => {
      const code = `p.analyticsEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })`;
      expect(violations(code)).toEqual([]);
    });

    it('distinct без take (полная выборка) и агрегат groupBy — законно', () => {
      const code = `p.rating.findMany({ distinct: ['needId'] }); p.rating.groupBy({ by: ['needId'], _avg: { value: true } })`;
      expect(violations(code)).toEqual([]);
    });
  });
});
