// Инвариант аудита 2026-10 (booking-cas, строки 463/465): запись статуса
// брони/подписки/списания/доната — только с предикатом статуса в `where`.
//
// Класс: `findMany`/`findUnique` → проверка статуса в памяти → `update` по id.
// Между чтением и записью строку успевает перевести соседний проход (вебхук
// оплаты, крон истечения, вторая вкладка с отменой), и запись по одному id
// затирает чужой переход: CONFIRMED перекрашивается в CANCELLED, эффекты идут
// по старому снимку. Лечится CAS-ом: `updateMany({ where: { id, status: … } })`
// и решением по `count`. Живое доказательство — test/payment-webhooks.e2e-spec.ts.
//
// Правило: вызов `.update` / `.updateMany` на делегате booking | subscription |
// subscriptionCharge | donation, у которого в литерале `data` есть ключ
// `status`, обязан иметь ключ `status` в литерале `where`. Неразбираемое —
// нарушение: аргумент не литерал, `data`/`where` не литерал, spread не-литерала
// в `data`. Исключений нет (правило №15), allow-list пуст.
//
// Граница проверки: computed key (`[k]: …`), запись через переменную-делегат
// (`const d = prisma.booking; d.update(…)`) и косвенные вызовы (хелпер, который
// принимает `data`) тест не видит. Raw SQL — отдельный класс (правило №18).
import { readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import * as ts from 'typescript';
import { collectSourceFiles } from '../../security/collect-source-files';

const SRC = join(__dirname, '..', '..');
const DELEGATES = new Set([
  'booking',
  'subscription',
  'subscriptionCharge',
  'donation',
]);
const WRITES = new Set(['update', 'updateMany']);

function sourceFiles(dir: string): string[] {
  return collectSourceFiles(dir, {
    filter: (p) => !relative(dir, p).split(sep).includes('test-support'),
  });
}

type Keys = { keys: Set<string>; opaque: boolean };

function literalKeys(node: ts.Node | undefined): Keys | null {
  if (!node || !ts.isObjectLiteralExpression(node)) return null;
  const keys = new Set<string>();
  let opaque = false;
  for (const p of node.properties) {
    if (ts.isSpreadAssignment(p)) {
      const inner = literalKeys(p.expression);
      if (!inner || inner.opaque) opaque = true;
      else inner.keys.forEach((k) => keys.add(k));
    } else if (
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
    ) {
      keys.add(p.name.text);
    }
    // computed key (`[field]: …`) — граница проверки, см. шапку: имя поля
    // не определить без типов; таких записей статуса в проекте нет.
  }
  return { keys, opaque };
}

function prop(obj: ts.ObjectLiteralExpression, name: string): ts.Node | null {
  for (const p of obj.properties) {
    if (
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
      p.name.getText() === name
    )
      return ts.isPropertyAssignment(p) ? p.initializer : p.name;
  }
  return null;
}

/** Строки вида `файл:строка вызов — причина` для нарушений в исходнике. */
export function violations(code: string): string[] {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      WRITES.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      DELEGATES.has(node.expression.expression.name.text)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const call = `${node.expression.expression.name.text}.${node.expression.name.text}`;
      const bad = (why: string) => found.push(`${line}: ${call} — ${why}`);
      const arg = node.arguments[0];
      if (!arg || !ts.isObjectLiteralExpression(arg)) {
        bad('аргумент не литерал');
      } else {
        const data = literalKeys(prop(arg, 'data') ?? undefined);
        if (!data) bad('data не литерал');
        else if (data.keys.has('status') || data.opaque) {
          const where = literalKeys(prop(arg, 'where') ?? undefined);
          if (!where) bad('where не литерал');
          else if (!where.keys.has('status')) {
            bad(
              data.keys.has('status')
                ? 'data.status без status в where'
                : 'data со spread не-литерала и без status в where',
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('запись статуса брони/подписки/списания/доната — только с предикатом статуса', () => {
  it('в src/** нет update/updateMany с data.status без status в where', () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      violations(readFileSync(file, 'utf8')).map(
        (v) => `${relative(SRC, file)}:${v}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('сканер видит записи статуса в сервисах (иначе проверка ничего не доказывает)', () => {
    const withCas = sourceFiles(SRC)
      .filter((f) =>
        /\b(?:booking|subscription|subscriptionCharge|donation)\.updateMany\(/.test(
          readFileSync(f, 'utf8'),
        ),
      )
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(withCas).toEqual(
      expect.arrayContaining([
        'booking/booking.transitions.ts',
        'subscription/subscription.service.ts',
        'donation/donation.service.ts',
      ]),
    );
  });

  describe('контрольные образцы', () => {
    it('update по id с data.status — красный', () => {
      const code = `async f() { await prisma.booking.update({ where: { id }, data: { status: 'CONFIRMED' } }); }`;
      expect(violations(code)).toHaveLength(1);
    });

    it('updateMany с status в where — зелёный', () => {
      const code = `async f() { await prisma.booking.updateMany({ where: { id, status: 'HELD' }, data: { status: 'CONFIRMED' } }); }`;
      expect(violations(code)).toEqual([]);
    });

    it('shorthand status в where считается', () => {
      const code = `async f() { await prisma.donation.updateMany({ where: { id, status }, data: { status: 'paid' } }); }`;
      expect(violations(code)).toEqual([]);
    });

    it('tx.subscription.updateMany без статуса — красный', () => {
      const code = `async f() { await tx.subscription.updateMany({ where: { id }, data: { status: 'cancelled' } }); }`;
      expect(violations(code)).toHaveLength(1);
    });

    it('deps.prisma.subscriptionCharge.update без статуса — красный', () => {
      const code = `async f() { await deps.prisma.subscriptionCharge.update({ where: { id }, data: { status: 'failed' } }); }`;
      expect(violations(code)).toHaveLength(1);
    });

    it('data без status (paidAt, calDavUid) не считается', () => {
      const code = `async f() { await prisma.booking.update({ where: { id }, data: { calDavUid: uid } }); }`;
      expect(violations(code)).toEqual([]);
    });

    it('update(args) с неразбираемым аргументом — красный', () => {
      expect(
        violations(`async f() { await prisma.booking.update(args); }`),
      ).toHaveLength(1);
    });

    it('computed key в data (динамическое поле напоминания) не считается', () => {
      const code = `async f() { await prisma.booking.update({ where: { id }, data: { [field]: new Date() } }); }`;
      expect(violations(code)).toEqual([]);
    });

    it('data не литерал — красный; where не литерал при data.status — красный', () => {
      expect(
        violations(
          `async f() { await prisma.booking.update({ where: { id }, data }); }`,
        ),
      ).toHaveLength(1);
      expect(
        violations(
          `async f() { await prisma.booking.update({ where, data: { status: 'X' } }); }`,
        ),
      ).toHaveLength(1);
    });

    it('spread не-литерала в data без status в where — красный', () => {
      const code = `async f() { await prisma.booking.updateMany({ where: { id }, data: { ...patch } }); }`;
      expect(violations(code)).toHaveLength(1);
    });

    it('другие делегаты (setting, article) не проверяются', () => {
      const code = `async f() { await prisma.article.update({ where: { id }, data: { status: 'x' } }); }`;
      expect(violations(code)).toEqual([]);
    });
  });
});
