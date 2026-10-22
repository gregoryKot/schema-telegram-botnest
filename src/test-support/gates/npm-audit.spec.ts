// Обёртка scripts/npm-audit.mjs (регресс #814, 2026-10-22): голый `npm audit`
// в CI висел на реестре до таймаута шага и красил main без единой
// уязвимости. Здесь обёртка ИСПОЛНЯЕТСЯ с поддельным npm на PATH, который
// отвечает записанными ответами реестра (fake-npm.ts): оба исхода, повторы,
// убийство зависшей попытки и флаги npm. Флаги теперь живут в обёртке, а не в
// ci.yml, — значит, ослабление уровня или потеря --omit=dev ловится здесь.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { makeFakeNpm, type FakeNpm } from './fake-npm';
import { isGatingAudit, prefixDirectory } from './lockfile-audit';

const SCRIPT = join(process.cwd(), 'scripts', 'npm-audit.mjs');
let npm: FakeNpm;

beforeAll(() => {
  npm = makeFakeNpm();
});
afterAll(() => npm.cleanup());
beforeEach(() => npm.reset());
afterEach(() => npm.killChildren());

function audit(
  rules: string,
  args = ['webapp'],
  attempts = '3',
  extra: Record<string, string> = {},
) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: npm.env(rules, {
      NPM_AUDIT_ATTEMPTS: attempts,
      NPM_AUDIT_ATTEMPT_MS: '1500',
      NPM_AUDIT_PAUSE_MS: '20',
      ...extra,
    }),
    encoding: 'utf8',
    timeout: 30_000,
  });
  // Обёртка, убитая по таймауту spawnSync, выходит 143 — не путать с исходом.
  if (r.error || r.signal) {
    throw new Error(
      `обёртка не завершилась сама за ${Date.now() - started} мс: ` +
        `${r.error?.message ?? ''} ${r.signal ?? ''} (status ${r.status})`,
    );
  }
  return {
    status: r.status,
    out: `${r.stdout}${r.stderr}`,
    calls: npm.calls(),
    ms: Date.now() - started,
  };
}

describe('scripts/npm-audit.mjs', () => {
  it('чистый отчёт: 0 с одной попытки; флаги npm — prod-зависимости, уровень high, JSON', () => {
    const r = audit('*=clean');
    expect(r.status).toBe(0);
    expect(r.out).toContain('high/critical в prod-зависимостях нет');
    expect(r.calls).toHaveLength(1);
    const [call] = r.calls;
    expect(call.split(' ')).toEqual(
      expect.arrayContaining([
        'audit',
        '--omit=dev',
        '--audit-level=high',
        '--json',
      ]),
    );
    expect(call).toMatch(/--fetch-timeout=\d+/);
    // Реестр и онлайн — флагами: env и .npmrc им не указ (см. образец ниже).
    expect(call.split(' ')).toEqual(
      expect.arrayContaining([
        '--offline=false',
        '--registry=https://registry.npmjs.org/',
      ]),
    );
    expect(prefixDirectory(call)).toBe('/webapp');
    expect(isGatingAudit(call)).toBe(true);
  });

  it('корень — «.»: npm получает --prefix .', () => {
    const r = audit('*=clean', ['.']);
    expect(r.status).toBe(0);
    expect(r.calls.map(prefixDirectory)).toEqual(['/']);
  });

  it('только moderate: 0 — ниже high не гейтим', () => {
    const r = audit('*=moderate');
    expect(r.status).toBe(0);
    expect(r.out).toContain('moderate — 1');
  });

  // Контроль к moderate: тот же формат с одной high — красный. Пара пинит
  // уровень с обеих сторон: ни critical-only, ни «любая находка».
  it('high: 1 сразу, без повторов; пакет и advisory названы', () => {
    const r = audit('*=high,clean');
    expect(r.status).toBe(1);
    expect(r.calls).toHaveLength(1);
    expect(r.out).toContain(
      '::error::npm audit webapp: в prod-зависимостях high — 1, critical — 0',
    );
    expect(r.out).toContain(
      'postcss — high, затронуто <=8.5.22; исправлено в 8.5.31',
    );
    expect(r.out).toContain('GHSA-6g55-p6wh-862q');
    expect(r.out).not.toContain('GHSA-7fh5-64p2-3v2j'); // moderate-advisory не в списке
  });

  it('critical: 1, названы оба пакета', () => {
    const r = audit('*=critical');
    expect(r.status).toBe(1);
    expect(r.out).toContain('lodash — high');
    expect(r.out).toContain('minimist — critical');
  });

  it('первая попытка висит: npm и его дети убиты, вторая чистая → 0', () => {
    const r = audit('*=hang,clean');
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(2);
    expect(r.out).toMatch(
      /::warning::.*попытка 1\/3 без отчёта — нет ответа за 1\.5 с, процесс npm убит/,
    );
    expect(npm.aliveChildren()).toEqual([]);
    expect(r.ms).toBeLessThan(10_000);
  });

  it('реестр отвечает 400 «endpoint retired» во всех попытках: 2, ::error:: про реестр, не про уязвимость', () => {
    const r = audit('*=registry-400');
    expect(r.status).toBe(2);
    expect(r.calls).toHaveLength(3);
    expect(r.out).toContain('реестр ответил ошибкой: 400 Bad Request');
    expect(r.out).toContain('Invalid package tree');
    expect(r.out).toContain(
      '::error::npm audit webapp: реестр npm не ответил (попыток: 3) — это не уязвимость; перезапусти джобу',
    );
    expect(r.out).not.toContain('в prod-зависимостях high');
  });

  it('не-JSON и пустой вывод — отчёта нет, повтор; третья попытка чистая → 0', () => {
    const r = audit('*=garbage,empty,clean');
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(3);
    expect(r.out).toContain('попытка 1/3 без отчёта — ответ npm — не JSON');
    expect(r.out).toContain('попытка 2/3 без отчёта — npm ничего не вывел');
  });

  it('все попытки висят: 2, а не зелёный и не вечное ожидание', () => {
    const r = audit('*=hang', ['webapp'], '2');
    expect(r.status).toBe(2);
    expect(r.calls).toHaveLength(2);
    expect(npm.aliveChildren()).toEqual([]);
    expect(r.ms).toBeLessThan(10_000);
  });

  it('без каталога — текущий, как у npm audit без --prefix', () => {
    const r = audit('*=clean', []);
    expect(r.status).toBe(0);
    expect(r.calls.map(prefixDirectory)).toEqual(['/']);
  });

  // JSON без ошибки и без metadata ({}, сменившийся формат ошибки npm) —
  // не «чисто»: непроверенное зелёным не бывает.
  it('JSON без metadata.vulnerabilities: 2 после всех попыток, не 0', () => {
    const r = audit('*=nometa');
    expect(r.status).toBe(2);
    expect(r.calls).toHaveLength(3);
    expect(r.out).toContain(
      'попытка 3/3 без отчёта — в ответе нет metadata.vulnerabilities',
    );
    expect(r.out).not.toContain('high/critical в prod-зависимостях нет');
  });

  // Записанный ответ npm без lock-файла: повтор и перезапуск не помогут —
  // 3 сразу, причина названа кодом npm, а не «реестр не ответил».
  it('нет lock-файла (ENOLOCK): 3 с первой попытки, причина — код npm', () => {
    const r = audit('*=enolock,clean');
    expect(r.status).toBe(3);
    expect(r.calls).toHaveLength(1);
    expect(r.out).toContain(
      '::error::npm audit webapp: npm не может проверить каталог — ENOLOCK — This command requires an existing lockfile.',
    );
    expect(r.out).toContain('перезапуск не поможет');
    expect(r.out).not.toContain('реестр npm не ответил');
  });

  it('npm не запустился: 3, без повторов', () => {
    const r = audit('*=clean', ['webapp'], '3', { PATH: '/nonexistent' });
    expect(r.status).toBe(3);
    expect(r.out).toContain(
      'npm не может проверить каталог — npm не запустился',
    );
    expect(r.out).not.toContain('::warning::');
  });

  // Внук после setsid в группу не входит и держит stdout: обёртка обязана
  // закрыть свой конец, а не ждать его 30 с.
  it('внук, ушедший из группы процессов, не держит обёртку', () => {
    const r = audit('*=orphan,clean');
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(2);
    expect(r.ms).toBeLessThan(10_000);
  });

  // Контрольный образец к флагам: offline/чужой реестр в env не делают
  // прогон «чистым» — флаги в вызове всё равно те же (живой npm 10.9.4
  // флагу командной строки подчиняется, проверено при ревью #814).
  it('npm_config_offline и npm_config_registry в env: флаги вызова их перекрывают', () => {
    const r = audit('*=clean', ['webapp'], '3', {
      npm_config_offline: 'true',
      NPM_CONFIG_REGISTRY: 'http://127.0.0.1:9/',
    });
    expect(r.status).toBe(0);
    const args = r.calls[0].split(' ');
    expect(args).toContain('--offline=false');
    expect(args).toContain('--registry=https://registry.npmjs.org/');
  });

  it('SIGTERM снаружи (таймаут шага): 143, не 1 — «убит» не «уязвимость»', () => {
    const r = spawnSync(process.execPath, [SCRIPT, 'webapp'], {
      env: npm.env('*=hang', { NPM_AUDIT_ATTEMPT_MS: '20000' }),
      encoding: 'utf8',
      timeout: 1_500,
      killSignal: 'SIGTERM',
    });
    expect(r.status).toBe(143);
    expect(npm.aliveChildren()).toEqual([]);
  });
});
