// Тест общего сканера скобок scripts/gate-balance.mjs (check-cron-leader,
// check-dead-end-report). Сломанный баланс режет тело метода или catch-ветки
// не там — и гейт молча не видит то, что лежит за обрезом. Поэтому оба
// направления: скобка в строке не считается, а настоящая вложенность — да.
import { importExport } from './pattern-loader';

const call = (name: string, ...args: unknown[]): unknown =>
  JSON.parse(
    importExport(
      'gate-balance.mjs',
      name,
      `(fn) => fn(...${JSON.stringify(args)})`,
    ),
  );
const pair = (src: string, i: number, o: string, c: string) =>
  call('matchPair', src, i, o, c);

describe('gate-balance.mjs', () => {
  it('вложенные скобки: закрывающая — парная, а не первая', () => {
    const src = 'f(a(b), c)';
    expect(pair(src, 1, '(', ')')).toBe(src.length - 1);
  });

  it('скобка в строке и шаблоне не считается', () => {
    const src = "{ x = ')}'; y = `}`; }";
    expect(pair(src, 0, '{', '}')).toBe(src.length - 1);
  });

  it('экранированная кавычка не закрывает строку', () => {
    const src = "{ s = '\\'}'; }";
    expect(pair(src, 0, '{', '}')).toBe(src.length - 1);
  });

  it('контроль: без пары — -1', () => {
    expect(pair('{ a { b }', 0, '{', '}')).toBe(-1);
  });

  it('lineAt считает с единицы', () => {
    expect(call('lineAt', 'a\nb\nc', 4)).toBe(3);
  });
});
