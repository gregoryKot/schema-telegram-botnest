// Разбор для гейта source-walk.spec.ts: какие вызовы чтения каталога — обход
// дерева. Вынесен из спека (правило №10: гейт = движок + правила), чтобы спек
// не пух; здесь нет чтения диска — только текст в текст.
import * as ts from 'typescript';

export const ALLOWED_WALKER = 'src/security/collect-source-files.ts';
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
