// Тест гейта check-telegram-chat-id.mjs (класс инцидента #456): адрес
// отправки в Telegram не берётся из userId — ни у самой отправки, ни у
// вызывающих функции, чей параметр доходит до адреса (в том числе из другого
// файла); только через telegramIdFor/telegramIdsFor
// (src/auth/telegram-identity.ts). Оба исхода и контрольные образцы.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const run = (src: string, path = 'src/x/notify.ts') =>
  runGate('check-telegram-chat-id.mjs', { [path]: src });
const fn = (body: string) => `export async function f() {\n${body}\n}\n`;

// Обёртка в другом файле: параметр chatId доходит до sendBounded.
const NOTIFY_USER =
  'export async function notifyUser(bot: Bot, chatId: number, text: string): Promise<void> {\n' +
  '  await sendBounded(bot, chatId, text, {});\n}\n';

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
    const res = run(fn(line));
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
    expect(run(fn(line)).status).toBe(0);
  });

  it.each<[string, Record<string, string>, string]>([
    [
      'обёртка из другого файла',
      {
        'src/tg/notify-user.ts': NOTIFY_USER,
        'src/x/caller.ts': fn('await notifyUser(bot, Number(userId), "hi");'),
      },
      'src/x/caller.ts:2: адрес отправки «Number(userId)» — id аккаунта, а не чат (через notifyUser)',
    ],
    [
      'метод, приведение в обёртке и посредник в третьем файле',
      {
        'src/tg/sender.service.ts':
          'export class SenderService {\n' +
          '  async sendTo(target: number | string, text: string): Promise<void> {\n' +
          '    const chatId = Number(target);\n' +
          '    await this.bot.telegram.sendMessage(chatId, text);\n  }\n}\n',
        'src/x/relay.ts':
          'export const relay = (svc: SenderService, to: number) => svc.sendTo(to, "x");\n',
        'src/y/use.ts': fn('await relay(svc, user.id);'),
      },
      'src/y/use.ts:2: адрес отправки «user.id» — id аккаунта, а не чат (через relay)',
    ],
  ])('красный через параметр: %s', (_name, files, line) => {
    const res = runGate('check-telegram-chat-id.mjs', files);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(line);
  });

  it.each<[string, Record<string, string>]>([
    [
      'вызывающий берёт адрес из telegramIdFor',
      {
        'src/tg/notify-user.ts': NOTIFY_USER,
        'src/x/caller.ts': fn(
          'const chatId = await telegramIdFor(prisma, userId);\nawait notifyUser(bot, Number(chatId), "hi");',
        ),
      },
    ],
    [
      'параметр уходит только в текст',
      {
        'src/tg/greet.ts':
          'export async function greet(chatId: number, who: bigint) {\n  await sendTg(chatId, `hi ${who}`);\n}\n',
        'src/x/caller.ts': fn('await greet(adminId, userId);'),
      },
    ],
    [
      // Слепая зона: у одноимённых `send` адресный аргумент не общий.
      'одноимённый метод, отправляющий не из каждого объявления',
      {
        'src/tg/channel.ts':
          'export class Channel {\n  async send(post: Post, destination: string) {\n' +
          '    await sendBounded(this.bot, destination, post.text, undefined);\n  }\n}\n',
        'src/mail/mail.ts':
          'export class Mail {\n  async send(to: string, subject: string) {\n' +
          '    return this.transport.post(to, subject);\n  }\n}\n',
        'src/x/caller.ts': fn('await this.mail.send("a@b.c", String(userId));'),
      },
    ],
  ])('контроль через параметр, зелёный: %s', (_name, files) => {
    expect(runGate('check-telegram-chat-id.mjs', files).status).toBe(0);
  });

  it('спеки и EXEMPT_FILES не проверяются, но отправщик из EXEMPT_FILES разбирается', () => {
    const bad = 'await bot.telegram.sendMessage(Number(userId), text);\n';
    expect(run(bad, 'src/x/notify.spec.ts').status).toBe(0);
    expect(run(bad, 'src/auth/telegram-identity.ts').status).toBe(0);
    expect(run(bad, 'src/auth/telegram-identity.helper.ts').status).toBe(1);
    const res = runGate('check-telegram-chat-id.mjs', {
      'src/bot/account.service.ts': NOTIFY_USER,
      'src/x/caller.ts': fn('await notifyUser(bot, uid, "hi");'),
    });
    expect(res.stderr).toContain('src/x/caller.ts:2:');
    expect(
      loadStringList('check-telegram-chat-id.mjs', 'EXEMPT_FILES'),
    ).toEqual(['src/auth/telegram-identity.ts', 'src/bot/account.service.ts']);
  });
});
