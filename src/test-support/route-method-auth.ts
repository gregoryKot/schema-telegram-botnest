// Разбор HTTP-роутов контроллера ПО МЕТОДУ (AST, не регэксп по файлу).
// Трипваер route-auth раньше считал контроллер «под гвардом», если
// `@UseGuards(...)` встречался где угодно в файле: гвард на одном методе
// делал защищённым весь файл, и новый анонимный `@Post` рядом молчал
// (аудит 2026-10). Здесь единица учёта — метод. Многострочный
// `@Throttle({...})` между декораторами AST не ломает, в отличие от регэкспа.
import * as ts from 'typescript';

const ROUTE_DECORATORS = new Set(['Get', 'Post', 'Patch', 'Delete', 'Put']);

// Единственные списки гвардов (правило №4): по ним идёт и разбор по методу, и
// файловый GUARD_RE (classify(), «контроллер классифицирован»). Защищает только
// GUARD_NAMES; OPTIONAL_GUARD_NAMES пропускают анонима, и такой метод обязан
// быть в OPTIONAL_AUTH_BY_DESIGN (`src/security/optional-auth-routes.ts`; до
// 2026-11 шесть роутов входа под OptionalJwtGuard числились защищёнными).
export const GUARD_NAMES = ['TelegramAuthGuard', 'JwtAuthGuard'] as const;
export const OPTIONAL_GUARD_NAMES = ['OptionalJwtGuard'] as const;
const GUARD_SET = new Set<string>(GUARD_NAMES);
const OPTIONAL_SET = new Set<string>(OPTIONAL_GUARD_NAMES);
const ANY_GUARD = [...GUARD_NAMES, ...OPTIONAL_GUARD_NAMES].join('|');

/** Файл с любым гвардом входа — контроллер разбирается по методу. */
export const GUARD_RE = new RegExp(`@UseGuards\\(\\s*[^)]*(${ANY_GUARD})`);

export interface RouteMethod {
  /**
   * `auth/auth.controller.ts:refresh`. Без имени класса: два @Controller в
   * одном файле с методами одного имени делили бы ключ — это ловит
   * `duplicateKeys` на реальном дереве (route-auth.invariants.spec.ts).
   */
  key: string;
  /** где стоит @UseGuards с одним из GUARD_NAMES */
  guard: 'class' | 'method' | null;
  /** где стоит @UseGuards с одним из OPTIONAL_GUARD_NAMES (аноним проходит) */
  optional: 'class' | 'method' | null;
  /** тело метода зовёт `assertAdminKey(` */
  callsAdminKey: boolean;
}

function decoratorCall(d: ts.Decorator): ts.CallExpression | null {
  return ts.isCallExpression(d.expression) ? d.expression : null;
}

function decoratorName(d: ts.Decorator): string | null {
  const call = decoratorCall(d);
  return call && ts.isIdentifier(call.expression) ? call.expression.text : null;
}

/** Есть ли среди декораторов `@UseGuards(<гвард из names>)`. */
function hasGuard(node: ts.HasDecorators, names: Set<string>): boolean {
  return (ts.getDecorators(node) ?? []).some((d) => {
    if (decoratorName(d) !== 'UseGuards') return false;
    return (decoratorCall(d)?.arguments ?? []).some(
      (a) => ts.isIdentifier(a) && names.has(a.text),
    );
  });
}

type Node = ts.HasDecorators;
const where = (cls: Node, m: Node, names: Set<string>) =>
  hasGuard(cls, names) ? 'class' : hasGuard(m, names) ? 'method' : null;

function callsAssertAdminKey(body: ts.Node | undefined): boolean {
  let found = false;
  const walk = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'assertAdminKey'
    ) {
      found = true;
    }
    if (!found) ts.forEachChild(n, walk);
  };
  if (body) walk(body);
  return found;
}

export function routeMethods(rel: string, src: string): RouteMethod[] {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
  const out: RouteMethod[] = [];
  for (const cls of sf.statements.filter(ts.isClassDeclaration)) {
    const isController = (ts.getDecorators(cls) ?? []).some(
      (d) => decoratorName(d) === 'Controller',
    );
    if (!isController) continue;
    for (const m of cls.members.filter(ts.isMethodDeclaration)) {
      const isRoute = (ts.getDecorators(m) ?? []).some((d) =>
        ROUTE_DECORATORS.has(decoratorName(d) ?? ''),
      );
      if (!isRoute) continue;
      out.push({
        key: `${rel}:${m.name.getText(sf)}`,
        guard: where(cls, m, GUARD_SET),
        optional: where(cls, m, OPTIONAL_SET),
        callsAdminKey: callsAssertAdminKey(m.body),
      });
    }
  }
  return out;
}

/** Не под гвардом и не в своём реестре: optional — OPTIONAL_AUTH_BY_DESIGN, иначе ANONYMOUS_BY_DESIGN. */
export function unclassifiedRoutes(
  methods: RouteMethod[],
  anonymous: Record<string, string>,
  optional: Record<string, string>,
): string[] {
  return methods
    .filter((m) => !m.guard)
    .filter((m) => !(m.optional ? optional[m.key] : anonymous[m.key]))
    .map((m) => m.key);
}

/** Ключи, встретившиеся дважды: ANONYMOUS_BY_DESIGN не различил бы такие методы. */
export function duplicateKeys(methods: RouteMethod[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const { key } of methods) (seen.has(key) ? dup : seen).add(key);
  return [...dup];
}
