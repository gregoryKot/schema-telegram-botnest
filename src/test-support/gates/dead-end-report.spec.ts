// Тест гейта check-dead-end-report.mjs (правило №14): catch-ветка страницы,
// рисующая исход-ошибку, классифицирована — отчёт наверх, исключение с
// причиной или видимый долг. Образец — SubscribePage: «Не удалось загрузить
// подписку» без отчёта до 2026-11.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

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

  it('исход-литерал: setStatus("error"), { kind: "failed" }, try/catch с типом; контроль: данные и комментарий', () => {
    const src = [
      'export function X() {',
      "  try { await a(); } catch (e: unknown) { setStatus('error'); }",
      "  try { await b(); } catch { settle({ kind: 'failed' }); }",
      '  try { await c(); } catch { setStatus(next); }',
      '  try { await d(); } catch { /* setBrokenError(true) */ }',
      '}',
    ].join('\n');
    const res = run({ 'webapp/src/components/x/X.tsx': src }, {});
    expect(res.stderr).toContain('X.tsx::setStatus (L2)');
    expect(res.stderr).toContain('X.tsx::settle (L3)');
    expect(res.stderr).not.toContain('L4');
    expect(res.stderr).not.toContain('setBrokenError');
  });

  it('сбой под пустым состоянием: catch без отчёта со setEnabled(false) — красный, ключ — первый сеттер', () => {
    const res = run({ [PAGE]: page('setEnabled(false); setOpts([]);') }, {});
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      `${PAGE}::setEnabled (L5): сбой под пустым состоянием, без отчёта без классификации`,
    );
    expect(res.stderr).not.toContain('::setOpts');
    const exempt = run(
      { [PAGE]: page('setEnabled(false); setOpts([]);') },
      {
        [`${PAGE}::setEnabled`]: {
          status: 'exempt',
          reason: 'вспомогательный блок, экран рабочий',
        },
      },
    );
    expect(exempt.status).toBe(0);
  });

  it('контроль пустого состояния: с отчётом, с данными в сеттере, статус загрузки и без сеттеров — не исход', () => {
    const src = [
      "import { reportClientError } from '../api';",
      'export function X() {',
      "  a().catch(() => { reportClientError({ message: 'x', section: 's' }); setOpts([]); });",
      "  b().catch(() => { setOpts(prev); setPhase('loading'); });",
      '  c().catch(() => undefined);',
      '}',
    ].join('\n');
    const res = run({ 'webapp/src/pages/X.tsx': src }, {});
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('нейтральный статус в catch без отчёта — красный; контроль: тот же статус с отчётом — зелёный', () => {
    const res = run({ [PAGE]: page("setStatus('idle');") }, {});
    expect(res.stderr).toContain(
      `${PAGE}::setStatus (L5): сбой под пустым состоянием, без отчёта без классификации`,
    );
    const kind = run({ [PAGE]: page("setState({ kind: 'empty' });") }, {});
    expect(kind.stderr).toContain(`${PAGE}::setState (L5)`);
    const ok = run(
      {
        [PAGE]: page(
          "reportClientError({ message: 'x', section: 's' }); setStatus('idle');",
        ),
      },
      {},
    );
    expect(ok.stderr).toBe('');
    expect(ok.status).toBe(0);
  });

  it('модуль правил: каждый нейтральный статус из NEUTRAL_STATUSES в catch без отчёта — красный', () => {
    const statuses = loadStringList(
      'check-dead-end-report-rules.mjs',
      'NEUTRAL_STATUSES',
    );
    expect(statuses).toContain('idle');
    for (const st of statuses) {
      expect(run({ [PAGE]: page(`setStatus('${st}');`) }, {}).status).toBe(1);
    }
    expect(run({ [PAGE]: page("setStatus('loading');") }, {}).status).toBe(0);
  });

  it('смешанные сеттеры: хоть один пустой без отчёта — красный, ключ — пустой сеттер; контроль: все с данными', () => {
    const res = run({ [PAGE]: page('setPhase(next); setOpts([]);') }, {});
    expect(res.stderr).toContain(`${PAGE}::setOpts (L5): сбой под пустым`);
    expect(res.stderr).not.toContain('::setPhase');
    const ok = run({ [PAGE]: page('setPhase(next); setOpts(prev);') }, {});
    expect(ok.status).toBe(0);
  });

  it('загрузка в useEffect: .then(сеттер) без .catch — красный; контроль: .catch, .then(ok, fail), return и вне эффекта', () => {
    const effect = (body: string) =>
      `export function X() {\n  useEffect(() => {\n    ${body}\n  }, []);\n}\n`;
    const res = run({ [PAGE]: effect('api.load().then(setData);') }, {});
    expect(res.stderr).toContain(
      `${PAGE}::setData (L3): загрузка без обработки отказа (.then без .catch) без классификации`,
    );
    const chained = run(
      {
        [PAGE]: effect(
          'api.load().then(setData).finally(() => setBusy(true));',
        ),
      },
      {},
    );
    expect(chained.stderr).toContain(`${PAGE}::setData (L3)`);
    const controls = [
      'api.load().then(setData).catch((e) => { reportClientError(e); });',
      'api.load().then(setData, () => reportClientError({}));',
      'return api.load().then(setData);',
    ];
    for (const body of controls) {
      expect(run({ [PAGE]: effect(body) }, {}).stderr).toBe('');
    }
    const onClick =
      'export function X() {\n  const go = () => api.load().then(setData);\n}\n';
    expect(run({ [PAGE]: onClick }, {}).status).toBe(0);
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
