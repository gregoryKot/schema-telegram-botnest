// Тест гейта check-telegram-chat-id.mjs (класс инцидента #456): адрес
// отправки в Telegram не берётся из userId — ни у самой отправки, ни у
// вызывающих функции, чей параметр доходит до адреса (в том числе из другого
// файла); только через telegramIdFor/telegramIdsFor
// (src/auth/telegram-identity.ts). Оба исхода и контрольные образцы.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { importExport, loadStringList } from './pattern-loader';

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
    [
      'поле параметра: s.chatId',
      {
        'src/tg/push.ts':
          'export async function push(s: { chatId: number }, text: string) {\n  await sendTg(Number(s.chatId), text);\n}\n',
        'src/x/caller.ts': fn('await push({ chatId: userId }, "hi");'),
      },
      'src/x/caller.ts:2: адрес отправки «userId» — id аккаунта, а не чат (через push)',
    ],
    [
      'поле параметра: шаблон ({ chatId: to })',
      {
        'src/tg/push.ts':
          'export async function push({ chatId: to, text }: P) {\n  await sendTg(to, text);\n}\n',
        'src/x/caller.ts': fn('await push({ chatId: user.id, text: "hi" });'),
      },
      'src/x/caller.ts:2: адрес отправки «user.id» — id аккаунта, а не чат (через push)',
    ],
  ])('красный через параметр: %s', (_name, files, line) => {
    const res = runGate('check-telegram-chat-id.mjs', files);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(line);
  });

  it.each<[string, Record<string, string>]>([
    [
      'поле параметра: вызывающий кладёт настоящий чат',
      {
        'src/tg/push.ts':
          'export async function push(s: { chatId: number }, text: string) {\n  await sendTg(s.chatId, text);\n}\n',
        'src/x/caller.ts': fn(
          'const chatId = await telegramIdFor(prisma, userId);\nawait push({ chatId }, "hi");\nawait push({ chatId: Number(chatId), other: userId }, "hi");',
        ),
      },
    ],
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

  // Отправщик полем параметра: push(s) → sendTg(s.chatId).
  const PUSH =
    'export async function push(s: { chatId: number }, text: string) {\n  await sendTg(Number(s.chatId), text);\n}\n';
  // Два одноимённых send: канал шлёт в Telegram (адрес — аргумент 1), почта — нет.
  const CHANNEL =
    'export class Channel {\n  async send(post: Post, destination: string) {\n' +
    '    await sendBounded(this.bot, destination, post.text, undefined);\n  }\n}\n';
  const MAIL =
    'export class Mail {\n  async send(to: string, subject: string) {\n' +
    '    return this.transport.post(to, subject);\n  }\n}\n';
  const caller = (field: string, call: string) =>
    `export class Caller {\n  constructor(private readonly ${field}) {}\n  async go(userId: bigint) {\n    await ${call};\n  }\n}\n`;
  // Источник объекта: функция возвращает литерал с адресом.
  const settings = (chatId: string) =>
    `export function toSettings(r: Row) {\n  return { tz: r.tz, chatId: ${chatId} };\n}\n`;
  // Две функции notify: в tg/ шлёт в Telegram, в mail/ — письмо.
  const NOTIFY_FILES = {
    'src/tg/notify.ts':
      'export async function notify(chatId: number) {\n  await sendTg(chatId, "x");\n}\n',
    'src/mail/notify.ts':
      'export async function notify(to: string) {\n  await mailer.post(to, "x");\n}\n',
  };

  it.each<[string, Record<string, string>, string]>([
    [
      'объект-переменная: поле из литерала',
      {
        'src/tg/push.ts': PUSH,
        'src/x/caller.ts': fn(
          'const s = {\n  chatId: userId,\n};\nawait push(s, "hi");',
        ),
      },
      'src/x/caller.ts:2: адрес отправки «userId» — id аккаунта, а не чат (через push)',
    ],
    [
      'объект-переменная: присваивание поля',
      {
        'src/tg/push.ts': PUSH,
        'src/x/caller.ts': fn(
          'const s = {} as P;\ns.chatId = user.id;\nawait push(s, "hi");',
        ),
      },
      'src/x/caller.ts:3: адрес отправки «user.id» — id аккаунта, а не чат (через push)',
    ],
    [
      'объект-переменная — параметр посредника',
      {
        'src/tg/push.ts': PUSH,
        'src/y/relay.ts':
          'export async function relay(s: P) {\n  await push(s, "x");\n}\n',
        'src/x/caller.ts': fn('await relay({ chatId: userId });'),
      },
      'src/x/caller.ts:2: адрес отправки «userId» — id аккаунта, а не чат (через relay)',
    ],
    [
      'объект-переменная из функции-источника',
      {
        'src/tg/push.ts': PUSH,
        'src/tg/settings.ts': settings('r.userId'),
        'src/x/caller.ts': fn(
          'const s = toSettings(row);\nawait push(s, "hi");',
        ),
      },
      'src/tg/settings.ts:2: адрес отправки «r.userId» — id аккаунта, а не чат (через push)',
    ],
    [
      'метод по типу поля: this.channel.send',
      {
        'src/tg/channel.ts': CHANNEL,
        'src/mail/mail.ts': MAIL,
        'src/x/caller.ts': caller(
          'channel: Channel',
          'this.channel.send(post, String(userId))',
        ),
      },
      'src/x/caller.ts:4: адрес отправки «String(userId)» — id аккаунта, а не чат (через send)',
    ],
    [
      'метод по new: ch.send',
      {
        'src/tg/channel.ts': CHANNEL,
        'src/mail/mail.ts': MAIL,
        'src/x/caller.ts': fn(
          'const ch = new Channel(bot);\nawait ch.send(post, uid);',
        ),
      },
      'src/x/caller.ts:3: адрес отправки «uid» — id аккаунта, а не чат (через send)',
    ],
    [
      'функция по импорту',
      {
        ...NOTIFY_FILES,
        'src/x/caller.ts':
          "import { notify } from '../tg/notify';\n" +
          fn('await notify(userId);'),
      },
      'src/x/caller.ts:3: адрес отправки «userId» — id аккаунта, а не чат (через notify)',
    ],
  ])('красный, поток внутри функции: %s', (_name, files, line) => {
    const res = runGate('check-telegram-chat-id.mjs', files);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(line);
  });

  it.each<[string, Record<string, string>]>([
    [
      'объект-переменная: в поле настоящий чат',
      {
        'src/tg/push.ts': PUSH,
        'src/x/caller.ts': fn(
          'const s = { chatId: await telegramIdFor(prisma, userId), userId };\nawait push(s, "hi");',
        ),
      },
    ],
    [
      'объект-переменная: присвоен настоящий чат',
      {
        'src/tg/push.ts': PUSH,
        'src/x/caller.ts': fn(
          'const s = {} as P;\ns.chatId = chatId;\nawait push(s, String(userId));',
        ),
      },
    ],
    [
      'посредник: вызывающий кладёт настоящий чат',
      {
        'src/tg/push.ts': PUSH,
        'src/y/relay.ts':
          'export async function relay(s: P) {\n  await push(s, "x");\n}\n',
        'src/x/caller.ts': fn('await relay({ chatId: tgId, userId });'),
      },
    ],
    [
      'источник берёт адрес из resolveChatId (AuthProvider)',
      {
        'src/tg/push.ts': PUSH,
        'src/tg/settings.ts': settings(
          'resolveChatId(r.id, r.authProviders?.[0]?.providerId)',
        ),
        'src/x/caller.ts': fn(
          'const s = toSettings(row);\nawait push(s, "hi");',
        ),
      },
    ],
    [
      // Известный пропуск: что лежит в карте, без типов не узнать.
      'известный пропуск: объект из map.get',
      {
        'src/tg/push.ts': PUSH,
        'src/tg/settings.ts': settings('r.userId'),
        'src/x/caller.ts': fn(
          'const s = byUser.get(String(userId));\nawait push(s, "hi");',
        ),
      },
    ],
    [
      'метод по типу поля: this.mail.send не отправляет в Telegram',
      {
        'src/tg/channel.ts': CHANNEL,
        'src/mail/mail.ts': MAIL,
        'src/x/caller.ts': caller(
          'mail: Mail',
          'this.mail.send(String(userId), "subject")',
        ),
      },
    ],
    [
      // Известный пропуск: тип получателя-цепочки в файле не виден — общий аргумент одноимённых.
      'известный пропуск: this.deps.channel.send',
      {
        'src/tg/channel.ts': CHANNEL,
        'src/mail/mail.ts': MAIL,
        'src/x/caller.ts': caller(
          'deps: Deps',
          'this.deps.channel.send(post, String(userId))',
        ),
      },
    ],
    [
      'функция по импорту: notify почты',
      {
        ...NOTIFY_FILES,
        'src/x/caller.ts':
          "import { notify } from '../mail/notify';\n" +
          fn('await notify(userId);'),
      },
    ],
  ])('контроль, поток внутри функции, зелёный: %s', (_name, files) => {
    expect(runGate('check-telegram-chat-id.mjs', files).status).toBe(0);
  });

  it('telegram-chat-id-objects: источник объекта — вызов целиком', () => {
    const got: unknown = JSON.parse(
      importExport(
        'telegram-chat-id-objects.mjs',
        'callOf',
        '(c) => [c("await toSettings(r)"), c("this.svc.make(r, 1)"), c("byUser.get(id) ?? fallback"), c("{ chatId }") ?? null]',
      ),
    );
    expect(got).toEqual([
      { pre: '', name: 'toSettings', open: -1 },
      { pre: '.', recv: 'this.svc', name: 'make', open: -1 },
      null,
      null,
    ]);
  });

  it('telegram-chat-id-resolve: класс получателя из типа поля, параметра и new', () => {
    const got: unknown = JSON.parse(
      importExport(
        'telegram-chat-id-resolve.mjs',
        'receiverClass',
        '(r) => [r("constructor(private readonly mail: Mail) {}", "this.mail"), r("const ch = new Channel(bot);", "ch"), r("x: Pick<Mail, \\"send\\">,", "x"), r("a.b: Mail,", "this.a.b")]',
      ),
    );
    expect(got).toEqual(['Mail', 'Channel', null, null]);
  });

  it('telegram-chat-id-params: поле берётся из литерала, у объекта-переменной — нет', () => {
    const got: unknown = JSON.parse(
      importExport(
        'telegram-chat-id-params.mjs',
        'fieldOf',
        '(f) => [f("{ chatId: userId, x: 1 }", "chatId"), f("{ x: 1, chatId }", "chatId"), f("opts", "chatId") ?? null, f("{ other: 1 }", "chatId") ?? null, f("{ a: g(1, 2), chatId: h(x, y) }", "chatId")]',
      ),
    );
    expect(got).toEqual(['userId', 'chatId', null, null, 'h(x, y)']);
  });

  it('отправщики по имени: sendTg(адрес, …) и sendBounded(бот, адрес, …)', () => {
    const seeds: unknown = JSON.parse(
      importExport('telegram-chat-id-flow.mjs', 'SEED_SENDERS', '(s) => s'),
    );
    expect(seeds).toEqual({ sendTg: 0, sendBounded: 1 });
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
