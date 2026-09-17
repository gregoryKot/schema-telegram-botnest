// Тест гейта check-alert-throttle.mjs — класс «троттлинг сигнализации живёт
// у ВЫЗЫВАЮЩЕГО, а не в канале доставки» (см. заголовок скрипта и
// security-log.service.ts). Найдено: csrf_blocked/refresh_token_reuse слали
// DM без единого троттлинга — та же дыра, что уронила 2026-07-29
// (suspicious_initdata), только на call site, до которого точечный фикс не
// доехал.
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

describe('check-alert-throttle.mjs', () => {
  it('новый прямой вызов notifyAdminWithFallback() в обход бюджетированного канала — exit 1, называет файл', () => {
    const res = runGate('check-alert-throttle.mjs', {
      'scripts/alert-throttle-baseline.json': '{}',
      'src/some-flood-prone.service.ts': [
        "import { notifyAdminWithFallback } from './utils/admin-alert';",
        '',
        'export async function onEveryRequest() {',
        "  await notifyAdminWithFallback('boom', 'subj');",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/some-flood-prone.service.ts');
  });

  it('вызов занесён в бейслайн с причиной — exit 0', () => {
    const res = runGate('check-alert-throttle.mjs', {
      'scripts/alert-throttle-baseline.json': JSON.stringify({
        'src/some-flood-prone.service.ts':
          'зафиксировано осознанно для теста гейта — причина длиннее 20 символов',
      }),
      'src/some-flood-prone.service.ts': [
        "import { notifyAdminWithFallback } from './utils/admin-alert';",
        '',
        'export async function onEveryRequest() {',
        "  await notifyAdminWithFallback('boom', 'subj');",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 известных прямых исключений');
  });

  it('запись бейслайна протухла (файл больше не зовёт напрямую) — exit 1', () => {
    const res = runGate('check-alert-throttle.mjs', {
      // Бейслайн ссылается на файл, но в дереве прямого вызова уже нет
      // (например, переехал на SecurityLogService) — запись протухла.
      'scripts/alert-throttle-baseline.json': JSON.stringify({
        'src/some-flood-prone.service.ts': 'старая причина, вызов уже убрали',
      }),
      'src/some-flood-prone.service.ts': [
        'export async function onEveryRequest() {',
        "  console.log('no longer calls notifyAdminWithFallback');",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухли');
    expect(res.stderr).toContain('src/some-flood-prone.service.ts');
  });

  it('известный бюджетированный канал (security-log.service.ts) — exit 0 без бейслайна', () => {
    const res = runGate('check-alert-throttle.mjs', {
      'scripts/alert-throttle-baseline.json': '{}',
      'src/auth/security-log.service.ts': [
        "import { notifyAdminWithFallback } from '../utils/admin-alert';",
        '',
        'export async function alertAdmin() {',
        "  await notifyAdminWithFallback('boom', 'subj');",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 файлов зовут');
    expect(res.stdout).toContain('0 известных прямых исключений');
  });

  it('спек-файл, зовущий notifyAdminWithFallback(), не считается — тесты не гейтятся', () => {
    const res = runGate('check-alert-throttle.mjs', {
      'scripts/alert-throttle-baseline.json': '{}',
      'src/some-flood-prone.service.spec.ts': [
        "import { notifyAdminWithFallback } from './utils/admin-alert';",
        '',
        "notifyAdminWithFallback('boom', 'subj');",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 файлов зовут');
  });

  // stripComments — тот самый класс подстрочного совпадения, что уронил вход
  // в инциденте 2026-08-08 (indexOf('WebAppData=') находил tgWebAppData=), но
  // применённый наоборот: без него имя функции в комментарии/строке читается
  // как настоящий вызов. До этого теста stripComments был вообще не покрыт —
  // выключение всей функции ни один тест не ловил.
  it('упоминание notifyAdminWithFallback() в комментарии — не вызов, не считается', () => {
    const res = runGate('check-alert-throttle.mjs', {
      'scripts/alert-throttle-baseline.json': '{}',
      'src/some-flood-prone.service.ts': [
        "// TODO: раньше здесь был notifyAdminWithFallback('boom', 'subj')",
        'export async function onEveryRequest() {}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 файлов зовут');
  });
});

// Механизм вместо добросовестности (как REGISTERED_FILES в
// check-capability-registry.mjs): у КАЖДОГО бюджетированного канала обязан
// быть живой пример. Замер 2026-08: alert.logger.ts можно было выкинуть из
// ALLOWED_CHANNELS бесследно — единственный тест на «известный канал»
// проверял только security-log.service.ts.
describe('каждый ALLOWED_CHANNELS пойман своим образцом', () => {
  const ALLOWED_CHANNELS = loadStringList(
    'check-alert-throttle.mjs',
    'ALLOWED_CHANNELS',
  );

  const CALL_SNIPPET = (rel: string) => ({
    'scripts/alert-throttle-baseline.json': '{}',
    [rel]: [
      "import { notifyAdminWithFallback } from '../utils/admin-alert';",
      '',
      'export async function alertAdmin() {',
      "  await notifyAdminWithFallback('boom', 'subj');",
      '}',
      '',
    ].join('\n'),
  });

  it.each(ALLOWED_CHANNELS.map((rel) => [rel] as const))(
    'канал «%s» не требует бейслайна',
    (rel) => {
      const res = runGate('check-alert-throttle.mjs', CALL_SNIPPET(rel));
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('0 известных прямых исключений');
    },
  );
});
