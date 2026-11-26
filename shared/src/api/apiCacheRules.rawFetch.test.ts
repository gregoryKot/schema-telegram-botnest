/// <reference types="node" />
// Сверка карты инвалидации, вторая половина: мутации мимо помощников api-слоя.
// apiCacheRules.coverage.test.ts видит только post/postJson/patchJson/del, а голый
// `fetch`/`authedFetch`/`fetchWithTimeout` с POST/DELETE/PATCH к /api/ шёл мимо неё —
// без сброса кеша GET по карте и без перевыпуска сессии на 401 (так жила заявка
// психолога на /account). Голая мутация — только из белого списка ниже.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const TREES = ['webapp/src', 'shared/src'];
// Тесты и тестовая обвязка подменяют fetch законно.
const NOT_SOURCE =
  /\.(test|spec)\.tsx?$|\.d\.ts$|\/test-support\/|\.test-helpers\.|\.fixture\./;

/** Вход и сессия: своя кука, CSRF, код 2FA; ответы мимо кеша (NO_CACHE в apiCache.ts). */
const AUTH_PREFIX = '/api/auth/';
/** Голые мутации вне /api/auth/ — с причиной (правило №15). */
const RAW_ALLOWED: Record<string, string> = {
  'POST /api/rating':
    'outbox оценок (ratingApi.ts) разбирает ответ сам; authedFetch сбрасывает кеш по карте, правило в ней есть',
  'POST /api/client-errors':
    'отчёт о сбое (clientErrorReport.ts) уходит без сессии, keepalive и тогда, когда сломан сам api-слой; GET у него нет',
};

const isAllowedRawMutation = (key: string): boolean =>
  key.split(' ')[1].startsWith(AUTH_PREFIX) || key in RAW_ALLOWED;

const RAW_FETCH = new Set(['fetch', 'authedFetch', 'fetchWithTimeout']);
const MUTATING = new Set(['POST', 'DELETE', 'PATCH', 'PUT']);
const CANDIDATE = /\b(?:fetch|authedFetch|fetchWithTimeout)\s*\(/;

/** `fetch(` и `window.fetch(` — да; `client.fetch(` — чужой метод. */
function rawCallee(e: ts.Expression): string | null {
  if (ts.isIdentifier(e)) return e.text;
  const global =
    ts.isPropertyAccessExpression(e) &&
    ts.isIdentifier(e.expression) &&
    ['window', 'globalThis', 'self'].includes(e.expression.text);
  return global ? e.name.text : null;
}

/** Текст строки или шаблона (`${…}` → 1); не литерал — null. */
function literalText(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return (
    node.head.text +
    node.templateSpans.map((s) => `1${s.literal.text}`).join('')
  );
}

/** Метод из `{ method: 'POST', … }` второго аргумента. */
function methodOf(init: ts.Expression | undefined): string | null {
  if (!init || !ts.isObjectLiteralExpression(init)) return null;
  const prop = init.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === 'method',
  );
  return literalText(prop?.initializer);
}

/** Голые мутации файла: `POST /api/x/1` по каждому вызову с путём-литералом. */
function rawMutationsIn(src: string, file = 'sample.ts'): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    false,
    kind,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      RAW_FETCH.has(rawCallee(node.expression) ?? '')
    ) {
      const path = literalText(node.arguments[0])?.match(/\/api\/[^?#]*/)?.[0];
      const method = methodOf(node.arguments[1]);
      if (path && method && MUTATING.has(method))
        found.push(`${method} ${path}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Список файлов — из git, а не своим обходом дерева (src/test-support/gates/source-walk.spec.ts). */
function collectRawMutations(): { key: string; file: string }[] {
  const files = execFileSync('git', ['ls-files', '--', ...TREES], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f) && !NOT_SOURCE.test(f));
  return files.flatMap((file) => {
    const src = readFileSync(join(REPO_ROOT, file), 'utf8');
    if (!CANDIDATE.test(src) || !src.includes('method')) return [];
    return rawMutationsIn(src, file).map((key) => ({ key, file }));
  });
}

describe('мутации мимо помощников api-слоя', () => {
  const found = collectRawMutations();

  it('голые вызовы вообще находятся (иначе сверка вечнозелёная)', () => {
    expect(found.length).toBeGreaterThan(10);
  });

  it('голая мутация к /api/ — только из белого списка', () => {
    const stray = found.filter((f) => !isAllowedRawMutation(f.key));
    expect(
      stray.map((f) => `${f.file}: ${f.key}`),
      'Мутация мимо post/postJson/patchJson/del: без перевыпуска сессии на 401 ' +
        'и без сброса кеша GET по карте. Переведи вызов на метод api-слоя ' +
        '(shared/src/api/sharedApi.ts) — или, если голый вызов правда нужен, ' +
        'запись с причиной в RAW_ALLOWED (этот файл).',
    ).toEqual([]);
  });

  it('каждая запись RAW_ALLOWED всё ещё встречается в коде', () => {
    const live = new Set(found.map((f) => f.key));
    expect(Object.keys(RAW_ALLOWED).filter((k) => !live.has(k))).toEqual([]);
  });

  it('образец: голый POST/DELETE/PATCH к /api/ — находка; вход, белый список, GET и чужой .fetch — нет', () => {
    const sample = [
      "fetch(`${API_BASE}/api/therapy/request`, { method: 'POST', body });",
      "await authedFetch(`/api/plan/${id}`, {\n  // без помощника\n  method: 'DELETE',\n});",
      "window.fetch('/api/feedback?x=1', { method: 'PATCH' });",
      'fetch(`${API_BASE}/api/therapy/request`, { headers });',
      "fetchWithTimeout(`${base}/api/auth/refresh`, { method: 'POST' });",
      "authedFetch('/api/rating', { method: 'POST', body });",
      "void fetch(`${base}/api/client-errors`, { method: 'POST', keepalive: true });",
      "authedFetch(path, withKeepalive({ method: 'POST' }, opts));",
      "client.fetch('/api/x', { method: 'POST' });",
    ].join('\n');
    const keys = rawMutationsIn(sample);
    expect(keys).toEqual([
      'POST /api/therapy/request',
      'DELETE /api/plan/1',
      'PATCH /api/feedback',
      'POST /api/auth/refresh',
      'POST /api/rating',
      'POST /api/client-errors',
    ]);
    expect(keys.filter((k) => !isAllowedRawMutation(k))).toEqual([
      'POST /api/therapy/request',
      'DELETE /api/plan/1',
      'PATCH /api/feedback',
    ]);
  });

  // Контрольный образец (№15): белый список не шире, чем нужно.
  it('мутация не из списка и не /api/auth/ — не разрешена', () => {
    expect(isAllowedRawMutation('POST /api/therapy/request')).toBe(false);
    expect(isAllowedRawMutation('POST /api/authors')).toBe(false);
  });
});
