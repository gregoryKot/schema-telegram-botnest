// Тема до первой отрисовки (`public/theme.js`). Файл лежит в public/ — его
// никто не импортирует, поэтому тест читает его с диска и исполняет с
// поддельными window/document/localStorage (образец — maxBridgeLoader.test.ts).
// Аудит 2026-10 (I4): раньше это был инлайн-<script>, который CSP блокировал.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(resolve(__dirname, '../public/theme.js'), 'utf8');
const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

function runTheme(storage: { getItem: (k: string) => string | null }) {
  const attrs: Record<string, string> = {};
  const root = {
    setAttribute: (k: string, v: string) => {
      attrs[k] = v;
    },
    style: { background: '', colorScheme: '' },
  };
  const document = { documentElement: root };
  new Function('document', 'localStorage', SOURCE)(document, storage);
  return { attrs, style: root.style };
}

describe('theme.js (public)', () => {
  it('тёмная тема — data-theme=dark, тёмный фон и color-scheme', () => {
    const { attrs, style } = runTheme({ getItem: () => 'dark' });
    expect(attrs['data-theme']).toBe('dark');
    expect(style.background).toBe('#14141a');
    expect(style.colorScheme).toBe('dark');
  });

  it('светлая тема — атрибут не ставится, фон светлый', () => {
    const { attrs, style } = runTheme({ getItem: () => 'light' });
    expect(attrs['data-theme']).toBeUndefined();
    expect(style.background).toBe('#f5f2eb');
    expect(style.colorScheme).toBe('light');
  });

  it('ничего не сохранено — светлый фон по умолчанию', () => {
    const { attrs, style } = runTheme({ getItem: () => null });
    expect(attrs['data-theme']).toBeUndefined();
    expect(style.background).toBe('#f5f2eb');
  });

  it('localStorage бросает (приватный режим) — скрипт не падает, светлая тема', () => {
    const { style } = runTheme({
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(style.background).toBe('#f5f2eb');
    expect(style.colorScheme).toBe('light');
  });

  it('index.html подключает его синхронным <script src>, а не инлайном', () => {
    expect(INDEX_HTML).toMatch(/<script src="\/theme\.js"><\/script>/);
  });
});
