// Тест гейта check-telegram-chat-id.mjs (класс инцидента #456): адрес
// отправки в Telegram не берётся из userId напрямую — только через
// telegramIdFor/telegramIdsFor (src/auth/telegram-identity.ts). Оба исхода и
// контрольные образцы законных адресов.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const run = (src: string, path = 'src/x/notify.ts') =>
  runGate('check-telegram-chat-id.mjs', { [path]: src });

describe('check-telegram-chat-id.mjs', () => {
  it('настоящее дерево — зелёный', () => {
    const res = spawnSync('node', ['scripts/check-telegram-chat-id.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it.each([
    [
      'sendMessage(Number(userId))',
      'await bot.telegram.sendMessage(Number(userId), text);',
    ],
    ['sendTg(notif.userId)', 'await this.sendTg(notif.userId, text);'],
    ['sendBounded(bot, user.id)', 'await sendBounded(bot, user.id, text, {});'],
    [
      'chat_id: String(userId)',
      'fetch(url, { body: JSON.stringify({ chat_id: String(userId), text }) });',
    ],
    [
      'через переменную',
      'const chatId = Number(row.userId);\nawait ctx.telegram.sendPhoto(chatId, photo);',
    ],
    ['uid.toString()', 'await bot.telegram.sendDocument(uid.toString(), doc);'],
  ])('красный: %s', (_name, line) => {
    const res = run(`export async function f() {\n${line}\n}\n`);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/x/notify.ts:');
    expect(res.stderr).toContain('id аккаунта, а не чат');
  });

  it.each([
    [
      'адрес из telegramIdFor',
      'const chatId = await telegramIdFor(prisma, userId);\nawait sendTg(chatId, text);',
    ],
    [
      'поиск по карте telegramIdsFor',
      'const chatId = chatIds.get(uid.toString());\nawait sendBounded(bot, Number(chatId), text, {});',
    ],
    ['админ', 'await bot.telegram.sendMessage(adminId, text);'],
    ['чат из апдейта', 'await ctx.telegram.sendMessage(ctx.chat.id, text);'],
    ['userId только в тексте', 'await sendTg(chatId, `user ${userId}`);'],
    [
      'упоминание в комментарии',
      '// раньше было sendMessage(Number(userId), …)\nawait sendTg(chatId, text);',
    ],
  ])('контроль, зелёный: %s', (_name, line) => {
    expect(run(`export async function f() {\n${line}\n}\n`).status).toBe(0);
  });

  it('спеки и EXEMPT_FILES не сканируются; EXEMPT_FILES — ровно два файла', () => {
    const bad = 'await bot.telegram.sendMessage(Number(userId), text);\n';
    expect(run(bad, 'src/x/notify.spec.ts').status).toBe(0);
    expect(run(bad, 'src/auth/telegram-identity.ts').status).toBe(0);
    expect(run(bad, 'src/auth/telegram-identity.helper.ts').status).toBe(1);
    expect(
      loadStringList('check-telegram-chat-id.mjs', 'EXEMPT_FILES'),
    ).toEqual(['src/auth/telegram-identity.ts', 'src/bot/account.service.ts']);
  });
});
