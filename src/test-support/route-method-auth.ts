// Разбор HTTP-роутов контроллера ПО МЕТОДУ (AST, не регэксп по файлу).
// Трипваер route-auth раньше считал контроллер «под гвардом», если
// `@UseGuards(...)` встречался где угодно в файле: гвард на одном методе
// делал защищённым весь файл, и новый анонимный `@Post` рядом молчал
// (аудит 2026-10). Здесь единица учёта — метод. Многострочный
// `@Throttle({...})` между декораторами AST не ломает, в отличие от регэкспа.
import * as ts from 'typescript';

const ROUTE_DECORATORS = new Set(['Get', 'Post', 'Patch', 'Delete', 'Put']);
const GUARD_NAMES = new Set([
  'TelegramAuthGuard',
  'JwtAuthGuard',
  'OptionalJwtGuard',
]);

export interface RouteMethod {
  /** `auth/auth.controller.ts:refresh` */
  key: string;
  /** где стоит @UseGuards с одним из GUARD_NAMES */
  guard: 'class' | 'method' | null;
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

/** Есть ли среди декораторов `@UseGuards(<известный гвард>)`. */
function hasGuard(node: ts.HasDecorators): boolean {
  return (ts.getDecorators(node) ?? []).some((d) => {
    if (decoratorName(d) !== 'UseGuards') return false;
    return (decoratorCall(d)?.arguments ?? []).some(
      (a) => ts.isIdentifier(a) && GUARD_NAMES.has(a.text),
    );
  });
}

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
    const classGuard = hasGuard(cls);
    for (const m of cls.members.filter(ts.isMethodDeclaration)) {
      const isRoute = (ts.getDecorators(m) ?? []).some((d) =>
        ROUTE_DECORATORS.has(decoratorName(d) ?? ''),
      );
      if (!isRoute) continue;
      out.push({
        key: `${rel}:${m.name.getText(sf)}`,
        guard: classGuard ? 'class' : hasGuard(m) ? 'method' : null,
        callsAdminKey: callsAssertAdminKey(m.body),
      });
    }
  }
  return out;
}
