// Тест гейта check-capability-registry.mjs — класс «ветка, зависящая от
// конфигурации, деградирует МОЛЧА» (щит, волна 8). Заголовный случай —
// src/utils/admin-alert.ts: без ключей КАЖДЫЙ алерт улетает в никуда без
// следа. Гейт ищет форму `if (!token/key/secret/process.env.X) return …`
// без throw и требует, чтобы файл был либо в REGISTERED_FILES (зеркало
// src/infra/capability-report.ts), либо в бейслайне с причиной.
import { runGate } from './gate-sandbox';

const SILENT_BRANCH = [
  'export async function maybeSend() {',
  '  const apiKey = process.env.SOME_NEW_API_KEY;',
  '  if (!apiKey) return;',
  "  await fetch('https://example.com', { headers: { apiKey } });",
  '}',
  '',
].join('\n');

describe('check-capability-registry.mjs', () => {
  it('новая незарегистрированная молчаливая ветка — exit 1, называет файл', () => {
    const res = runGate('check-capability-registry.mjs', {
      'scripts/capability-registry-baseline.json': '{}',
      'src/some-new-integration.service.ts': SILENT_BRANCH,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/some-new-integration.service.ts');
  });

  it('файл занесён в бейслайн с причиной — exit 0', () => {
    const res = runGate('check-capability-registry.mjs', {
      'scripts/capability-registry-baseline.json': JSON.stringify({
        'src/some-new-integration.service.ts':
          'зафиксировано осознанно для теста гейта — причина длиннее 20 символов',
      }),
      'src/some-new-integration.service.ts': SILENT_BRANCH,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 в бейслайне');
  });

  it('известный зарегистрированный канал (src/utils/admin-alert.ts) — exit 0 без бейслайна', () => {
    const res = runGate('check-capability-registry.mjs', {
      'scripts/capability-registry-baseline.json': '{}',
      'src/utils/admin-alert.ts': [
        'export async function sendTelegram(text: string) {',
        '  const token = process.env.BOT_TOKEN;',
        '  const chatId = process.env.ADMIN_ID;',
        '  if (!token || !chatId) return false;',
        '  return true;',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 файлов с молчаливыми ветками');
    expect(res.stdout).toContain('0 в бейслайне');
  });

  it('запись бейслайна протухла (файл больше не содержит такую ветку) — exit 1', () => {
    const res = runGate('check-capability-registry.mjs', {
      'scripts/capability-registry-baseline.json': JSON.stringify({
        'src/some-new-integration.service.ts':
          'старая причина, ветку уже убрали или файл переписали',
      }),
      'src/some-new-integration.service.ts': [
        'export async function maybeSend() {',
        "  console.log('no longer has a silent config branch');",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухли');
    expect(res.stderr).toContain('src/some-new-integration.service.ts');
  });

  it('ветка с throw — не считается силентной, не требует ни реестра, ни бейслайна', () => {
    const res = runGate('check-capability-registry.mjs', {
      'scripts/capability-registry-baseline.json': '{}',
      'src/some-strict.service.ts': [
        'export function requireKey() {',
        '  const secret = process.env.SOME_SECRET;',
        "  if (!secret) throw new Error('SOME_SECRET missing');",
        '  return secret;',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 файлов с молчаливыми ветками');
  });

  it('спек-файл с молчаливой веткой не считается — тесты не гейтятся', () => {
    const res = runGate('check-capability-registry.mjs', {
      'scripts/capability-registry-baseline.json': '{}',
      'src/some-new-integration.service.spec.ts': SILENT_BRANCH,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 файлов с молчаливыми ветками');
  });
});
