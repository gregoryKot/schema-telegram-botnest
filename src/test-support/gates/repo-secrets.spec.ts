// Тест гейта check-repo-secrets.mjs — реестр обязательных секретов
// репозитория (аудит 2026-10, по образцу реестра env №22). Список секретов
// гейт собирает сам из `secrets.X` в воркфлоу; ночной шаг nightly.yml
// передаёт признак «задан» строками HAS_X. Проверяем оба исхода: сверку
// списков (без секретов, как в PR) и признаки (--presence, как ночью).
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const WF = join(ROOT, '.github', 'workflows');
const SCRIPT = 'check-repo-secrets.mjs';
const BASELINE = 'scripts/repo-secrets-baseline.json';

const step = (...names: string[]) =>
  [
    'jobs:',
    '  repo-secrets:',
    '    steps:',
    '      - env:',
    ...names.map((n) => `          HAS_${n}: \${{ secrets.${n} != '' }}`),
    '        run: node scripts/check-repo-secrets.mjs --presence',
    '',
  ].join('\n');
const user = (...names: string[]) =>
  [
    'jobs:',
    '  notify:',
    '    steps:',
    '      - env:',
    ...names.map((n) => `          ${n}: \${{ secrets.${n} }}`),
    '        run: echo ok',
    '',
  ].join('\n');

function run(
  workflows: Record<string, string>,
  baseline: Record<string, unknown> = {},
  presence?: Record<string, boolean>,
) {
  const files: Record<string, string> = {
    [BASELINE]: JSON.stringify(baseline),
  };
  for (const [name, text] of Object.entries(workflows)) {
    files[`.github/workflows/${name}`] = text;
  }
  const env: Record<string, string> = { PATH: process.env.PATH ?? '' };
  for (const [k, v] of Object.entries(presence ?? {}))
    env[`HAS_${k}`] = String(v);
  return runGate(SCRIPT, files, {
    args: presence ? ['--presence'] : [],
    env,
  });
}

const reason = { reason: 'ждёт владельца: не заведён' };

describe('check-repo-secrets.mjs: сверка списков (PR)', () => {
  it('настоящие воркфлоу и бейслайн — зелёный: ночной шаг проверяет каждый секрет', () => {
    const workflows: Record<string, string> = {};
    for (const f of readdirSync(WF).filter((n) => /\.ya?ml$/.test(n))) {
      workflows[f] = readFileSync(join(WF, f), 'utf8');
    }
    const res = run(
      workflows,
      JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8')) as Record<
        string,
        unknown
      >,
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('ночной шаг проверяет все');
  });

  it('воркфлоу сослался на новый секрет, а ночной шаг его не проверяет — красный', () => {
    const res = run({
      'nightly.yml': step('BOT_TOKEN'),
      'alarm.yml': user('BOT_TOKEN', 'NOTIFY_BOT_TOKEN'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'secrets.NOTIFY_BOT_TOKEN (alarm.yml) ночной шаг не проверяет',
    );
    expect(res.stderr).toContain(
      "HAS_NOTIFY_BOT_TOKEN: ${{ secrets.NOTIFY_BOT_TOKEN != '' }}",
    );
  });

  it('лишняя строка HAS_ без ссылки в воркфлоу и несовпадение имён — красный', () => {
    const res = run({
      'nightly.yml':
        step('BOT_TOKEN', 'OLD_TOKEN') +
        "          HAS_ADMIN: ${{ secrets.ADMIN_ID != '' }}\n",
      'alarm.yml': user('BOT_TOKEN', 'ADMIN_ID'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'HAS_OLD_TOKEN в nightly.yml: ни один воркфлоу',
    );
    expect(res.stderr).toContain('HAS_ADMIN проверяет secrets.ADMIN_ID');
  });

  it('`secrets.mjs` в команде и закомментированная ссылка — не секреты', () => {
    const res = run({
      'nightly.yml':
        step() + '      - run: node scripts/check-repo-secrets.mjs\n',
      'ci.yml': '# env: X: ${{ secrets.COMMENTED }}\njobs: {}\n',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('динамическая ссылка secrets[…] — красный: статически не собрать', () => {
    const res = run({
      'nightly.yml': step(),
      'ci.yml': "env:\n  X: ${{ secrets[format('{0}', 'A')] }}\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('ci.yml:2: динамическая ссылка');
  });

  it('запись бейслайна о секрете, на который никто не ссылается, или без причины — красный', () => {
    const res = run(
      { 'nightly.yml': step('BOT_TOKEN'), 'alarm.yml': user('BOT_TOKEN') },
      { GONE: reason, BOT_TOKEN: { reason: '' } },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('на secrets.GONE никто не ссылается');
    expect(res.stderr).toContain('у BOT_TOKEN нет причины');
  });
});

describe('check-repo-secrets.mjs: признаки «задан» (ночь, --presence)', () => {
  const wf = {
    'nightly.yml': step('BOT_TOKEN', 'ADMIN_ID'),
    'alarm.yml': user('BOT_TOKEN', 'ADMIN_ID'),
  };

  it('всё заведено — зелёный', () => {
    const res = run(wf, {}, { BOT_TOKEN: true, ADMIN_ID: true });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('не заведён, но ждёт владельца в бейслайне — зелёный с предупреждением', () => {
    const res = run(
      wf,
      { ADMIN_ID: reason },
      { BOT_TOKEN: true, ADMIN_ID: false },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '::warning::repo-secrets: секрет ADMIN_ID не заведён: ждёт владельца',
    );
  });

  it('новый незаведённый секрет без записи — красный', () => {
    const res = run(
      wf,
      { ADMIN_ID: reason },
      { BOT_TOKEN: false, ADMIN_ID: false },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('секрет BOT_TOKEN не заведён (alarm.yml)');
  });

  it('секрет заведён, а запись «ждёт владельца» осталась — красный: запись протухла', () => {
    const res = run(
      wf,
      { ADMIN_ID: reason },
      { BOT_TOKEN: true, ADMIN_ID: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('секрет ADMIN_ID заведён — убери запись');
  });

  it('шаг не передал признак — красный', () => {
    const res = run(wf, {}, { BOT_TOKEN: true });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('шаг не передал HAS_ADMIN_ID');
  });
});

// Правило №15: список исключений — с тестом на своё имя и контрольным образцом.
describe('SYSTEM_SECRETS_EXEMPT', () => {
  const SYSTEM_SECRETS_EXEMPT = loadStringList(
    'check-repo-secrets.mjs',
    'SYSTEM_SECRETS_EXEMPT',
  );

  it('только системный токен GitHub', () => {
    expect(SYSTEM_SECRETS_EXEMPT).toEqual(['GITHUB_TOKEN']);
  });

  it.each(SYSTEM_SECRETS_EXEMPT.map((n) => [n] as const))(
    'образец: secrets.%s без строки HAS_ — зелёный',
    (name) => {
      const res = run({ 'nightly.yml': step(), 'ci.yml': user(name) });
      expect(res.status).toBe(0);
    },
  );

  it('контрольный образец: похожее, но не системное имя краснеет', () => {
    const res = run({
      'nightly.yml': step(),
      'ci.yml': user('GITHUB_TOKEN_2'),
    });
    expect(res.status).toBe(1);
  });
});
