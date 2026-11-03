// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('строки-переходы клиента: локальные хаки удалены (#906, волна 2)', () => {
  it.each(['!important', 'font-size: 0', "content: '›'", '.cp-breath', '.cp-chev', '--crisis', '.cp-empty', 'var(--err)'])(
    'client-practice.css: нет %s',
    (bad) => {
      const css = read('client-practice.css');
      if (bad === 'var(--err)') expect(css).not.toMatch(/background:\s*var\(--err\)/);
      else expect(css).not.toContain(bad);
    },
  );
  it('client-more.css: нет .cm-row и .cm-list', () => {
    const css = read('client-more.css');
    expect(css).not.toContain('.cm-row');
    expect(css).not.toContain('.cm-list');
  });
  it('client-today.css: нет .ct-empty', () => {
    expect(read('client-today.css')).not.toContain('.ct-empty');
  });
  it('client-why.css: нет .cw-h1', () => {
    expect(read('client-why.css')).not.toContain('.cw-h1');
  });
});
