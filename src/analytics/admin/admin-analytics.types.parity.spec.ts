// Сверка (правило №4): типы ответа админки на бэкенде и в shared/ — один
// контракт. Бэкенд shared не импортирует, поэтому сверяются тексты интерфейсов.
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8');

function interfaces(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /export interface (\w+)(?: extends \w+)? \{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === '{') depth++;
      if (src[i] === '}') depth--;
      i++;
    }
    const body = src
      .slice(m.index, i)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, '');
    out.set(m[1], body);
  }
  return out;
}

describe('контракт аналитики админки: бэкенд и shared совпадают', () => {
  const local = read('admin-analytics.types.ts');
  const shared = read(
    '..',
    '..',
    '..',
    'shared',
    'src',
    'analytics',
    'adminAnalytics.ts',
  );

  it('интерфейсы идентичны', () => {
    const a = interfaces(local);
    const b = interfaces(shared);
    expect(a.size).toBeGreaterThan(5);
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
    for (const [name, body] of a)
      expect([name, body]).toEqual([name, b.get(name)]);
  });

  it('окна дней одинаковы', () => {
    const days = (s: string) =>
      s.match(/ADMIN_ANALYTICS_DAYS = \[([^\]]*)\]/)?.[1].replace(/\s/g, '');
    expect(days(local)).toBe(days(shared));
    expect(days(local)).toBe('7,30,90');
  });
});
