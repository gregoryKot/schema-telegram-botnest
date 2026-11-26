// Тест общего разбора функций scripts/gate-functions.mjs (check-telegram-chat-id —
// путь адреса через параметр, check-next-session-reads — деструктуризация в
// параметрах). Ошибка разбора не краснит гейт, а молча прячет путь: функция без
// тела не станет отправщиком, а вызов, принятый за функцию, даст ложную находку.
import { importExport } from './pattern-loader';

interface Fn {
  name: string;
  params: (string | null)[];
  inert: boolean;
  body: string;
}

const fns = (src: string): Fn[] =>
  JSON.parse(
    importExport(
      'gate-functions.mjs',
      'functionsOf',
      `(fn) => fn(${JSON.stringify(src)}).map((f) => ({ name: f.name, params: f.params, inert: f.inert, body: ${JSON.stringify(src)}.slice(f.start, f.end) }))`,
    ),
  ) as Fn[];
const isParamList = (src: string, open: number): boolean =>
  JSON.parse(
    importExport(
      'gate-functions.mjs',
      'isParamList',
      `(fn) => fn(${JSON.stringify(src)}, ${open})`,
    ),
  ) as boolean;

describe('gate-functions.mjs', () => {
  it.each([
    [
      'объявление с типом возврата',
      'export async function send(bot: Bot, chatId: number): Promise<void> { go(chatId); }',
      'send',
      ['bot', 'chatId'],
      'go(chatId)',
    ],
    [
      'метод: модификаторы, дженерик в параметре, литерал типа в возврате',
      'class A { private async sendTo(to: Map<string, number>, t: string): Promise<{ ok: boolean }> { return post(to); } }',
      'sendTo',
      ['to', 't'],
      'post(to)',
    ],
    [
      'стрелка в константе',
      'const relay = async (svc: S, to: number) => svc.sendTo(to, "x");',
      'relay',
      ['svc', 'to'],
      'svc.sendTo(to, "x")',
    ],
    [
      'свойство объекта',
      '({ sendTg: (chatId, text) => this.sendTg(chatId, text) })',
      'sendTg',
      ['chatId', 'text'],
      'this.sendTg(chatId, text)',
    ],
    [
      'стрелка с одним параметром',
      'export const ping = chat => sendTg(chat, 1);',
      'ping',
      ['chat'],
      'sendTg(chat, 1)',
    ],
  ])('функция: %s', (_name, src, name, params, body) => {
    const f = fns(src).find((x) => x.name === name);
    expect(f).toMatchObject({ params, inert: false });
    expect(f?.body).toContain(body);
  });

  it('тип функции в интерфейсе — inert: отправить из него нечего', () => {
    const src =
      'interface D { sendTg: (chatId: bigint, text: string) => Promise<boolean>; }';
    expect(fns(src).find((x) => x.name === 'sendTg')?.inert).toBe(true);
  });

  it('контроль: условие, вызов и тип возврата — не функции', () => {
    const src =
      'if (ok) { go(1); } foo(a).then(b); const f = (e: unknown): string => String(e);';
    expect(fns(src).map((x) => x.name)).toEqual(['f']);
  });

  it('isParamList: параметры стрелки и метода — да, аргументы вызова и условие — нет', () => {
    const src =
      'rows.map(({ a }) => a); save({ a }); if (x) {} class C { m({ a }: P) {} }';
    expect(isParamList(src, src.indexOf('({ a }) =>'))).toBe(true);
    expect(isParamList(src, src.indexOf('({ a }: P)'))).toBe(true);
    expect(isParamList(src, src.indexOf('({ a });'))).toBe(false);
    expect(isParamList(src, src.indexOf('(x)'))).toBe(false);
  });
});
