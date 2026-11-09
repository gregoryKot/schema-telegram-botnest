// Тест гейта check-dead-end-report.mjs (правило №14): catch-ветка страницы,
// рисующая исход-ошибку, классифицирована — отчёт наверх, исключение с
// причиной или видимый долг. Образец — SubscribePage: «Не удалось загрузить
// подписку» без отчёта до 2026-11.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const ROOT = join(__dirname, '..', '..', '..');
const PAGE = 'webapp/src/pages/SubPage.tsx';
const KEY = `${PAGE}::setLoadFailed`;
const page = (catchBody: string, extra = '') =>
  [
    "import { api, reportClientError } from '../api';",
    'export function SubPage() {',
    extra,
    '  useEffect(() => {',
    `    api.load().then(setData).catch((err: unknown) => { ${catchBody} });`,
    '  }, []);',
    '}',
    '',
  ].join('\n');
const run = (
  files: Record<string, string>,
  baseline: Record<string, unknown>,
) =>
  runGate('check-dead-end-report.mjs', {
    ...files,
    'scripts/dead-end-report-baseline.json': JSON.stringify(baseline),
  });

describe('check-dead-end-report.mjs', () => {
  it('настоящее дерево и бейслайн — зелёный', () => {
    const res = spawnSync('node', ['scripts/check-dead-end-report.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('исход без классификации — красный, ключ файл::сеттер в отчёте', () => {
    const res = run({ [PAGE]: page('setLoadFailed(true);') }, {});
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${KEY} (L5): исход ошибки без классификации`);
  });

  it('reports + reportClientError в catch — зелёный; контроль: reports без отчёта — красный', () => {
    const ok = run(
      {
        [PAGE]: page(
          "reportClientError({ message: 'x', section: 's' }); setLoadFailed(true);",
        ),
      },
      { [KEY]: { status: 'reports' } },
    );
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('с отчётом 1');
    const bad = run(
      { [PAGE]: page('setLoadFailed(true);') },
      { [KEY]: { status: 'reports' } },
    );
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain(
      'объявлен reports, но в catch (L5) отчёта наверх нет',
    );
  });

  it('reports via хук: вызов в файле — зелёный; хука нет — красный', () => {
    const hook =
      '  useAuthFailureReport(reportClientError, failed ? { error: "x" } : null);';
    const entry = { [KEY]: { status: 'reports', via: 'useAuthFailureReport' } };
    expect(
      run({ [PAGE]: page('setLoadFailed(true);', hook) }, entry).status,
    ).toBe(0);
    const bad = run({ [PAGE]: page('setLoadFailed(true);') }, entry);
    expect(bad.stderr).toContain(
      'via «useAuthFailureReport», но вызова в файле нет',
    );
  });

  it('exempt и debt с причиной — зелёный, долг виден в итоге; короткая причина — красный', () => {
    const reason = 'ошибка действия у кнопки, экран рабочий';
    const ok = run(
      { [PAGE]: page('setLoadFailed(true);') },
      { [KEY]: { status: 'debt', reason } },
    );
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('долг 1');
    const short = run(
      { [PAGE]: page('setLoadFailed(true);') },
      { [KEY]: { status: 'exempt', reason: 'флак' } },
    );
    expect(short.stderr).toContain('короче 20 символов');
    const odd = run(
      { [PAGE]: page('setLoadFailed(true);') },
      { [KEY]: { status: 'ok', reason } },
    );
    expect(odd.stderr).toContain('неизвестный status');
  });

  it('протухшая запись — красный', () => {
    const res = run(
      { [PAGE]: page('setLoaded(true);') },
      { [KEY]: { status: 'reports' } },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`${KEY}: протухшая запись`);
  });

  it('исход-литерал: setStatus("error"), { kind: "failed" }, try/catch с типом; контроль: idle и комментарий', () => {
    const src = [
      'export function X() {',
      "  try { await a(); } catch (e: unknown) { setStatus('error'); }",
      "  try { await b(); } catch { settle({ kind: 'failed' }); }",
      "  try { await c(); } catch { setStatus('idle'); }",
      '  try { await d(); } catch { /* setBrokenError(true) */ }',
      '}',
    ].join('\n');
    const res = run({ 'webapp/src/components/x/X.tsx': src }, {});
    expect(res.stderr).toContain('X.tsx::setStatus (L2)');
    expect(res.stderr).toContain('X.tsx::settle (L3)');
    expect(res.stderr).not.toContain('L4');
    expect(res.stderr).not.toContain('setBrokenError');
  });

  it('область: верхний уровень components/ и тесты не сканируются', () => {
    const res = run(
      {
        'webapp/src/components/Top.tsx': page('setLoadFailed(true);'),
        'webapp/src/pages/SubPage.test.tsx': page('setLoadFailed(true);'),
      },
      {},
    );
    expect(res.status).toBe(0);
  });
});
