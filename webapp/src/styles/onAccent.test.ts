// @vitest-environment node
// Текст на залитом акценте — токен --on-accent, а не белый литерал. Белый
// темой не меняется: в тёмной теме --accent светлый (#9089e0), и белый на нём
// не читается, а --on-accent там тёмный (shared/src/theme/tokens.css). Свип по
// образцу #516 (--on-accent-red): DESIGN_AUDIT_2026-08, «Что по цвету открыто», п. 1.
// Сверка: ни одно CSS-правило сайта с заливкой ровно var(--accent) не красит
// текст белым литералом; то же для инлайн-объектов стиля в .ts/.tsx (webapp/src и shared/src).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');
const files = ['index.css', ...readdirSync(__dirname).filter((f) => f.endsWith('.css')).map((f) => `styles/${f}`)];

/** Правила (селектор → объявления) с заливкой ровно var(--accent) и белым текстом. */
function whiteOnAccent(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while ((m = re.exec(clean))) {
    const body = m[2];
    if (!/background(-color)?:\s*var\(--accent\)/.test(body)) continue;
    if (/(^|;|\s)color:\s*(#fff\b|#ffffff\b|white\b)/i.test(body)) out.push(m[1].trim());
  }
  return out;
}

/** Правила с заливкой var(--accent-hot) и цветом текста: на декор-токене текст не читается. */
function textOnHot(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while ((m = re.exec(clean))) {
    if (/background(-color)?:\s*var\(--accent-hot\)/.test(m[2]) && /(^|;|\s)color:/.test(m[2])) out.push(m[1].trim());
  }
  return out;
}

/** Инлайн-объекты стиля .ts/.tsx: в одном объекте (без вложенных скобок) заливка var(--accent), в том числе
 *  веткой тернарника, и цвет текста — белый литерал. Возвращает начало объекта для сообщения. */
function whiteOnAccentInline(src: string): string[] {
  const out: string[] = [];
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of clean.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1];
    if (!/background(Color)?:[^,;]*['"`]var\(--accent\)['"`]/.test(body)) continue;
    if (/(^|[\s,{])color:[^,;]*['"`](#fff|#ffffff|white)['"`]/i.test(body)) out.push(body.trim().slice(0, 80));
  }
  return out;
}

const tsxFiles = [SRC, join(SRC, '..', '..', 'shared', 'src')].flatMap((root) =>
  (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !f.includes('.test.'))
    .map((f) => join(root, f)));

describe('белый литерал на заливке --accent', () => {
  it.each(files)('%s: текст на акценте — var(--on-accent)', (f) => {
    expect(whiteOnAccent(readFileSync(join(SRC, f), 'utf8'))).toEqual([]);
  });

  it('контрольный образец: сверка видит белый на акценте', () => {
    expect(whiteOnAccent('.x { background: var(--accent); color: #fff; }')).toEqual(['.x']);
    expect(whiteOnAccent('.y { background: var(--accent-hot); color: #fff; }')).toEqual([]);
  });

  it('инлайн-стили .ts/.tsx: на заливке var(--accent) текст не белый литерал', () => {
    expect(tsxFiles.length).toBeGreaterThan(100);
    const bad = tsxFiles.flatMap((f) => whiteOnAccentInline(readFileSync(f, 'utf8')).map((b) => `${f}: ${b}`));
    expect(bad).toEqual([]);
  });

  it('контрольный образец: инлайн-сверка видит белый на акценте, и только его', () => {
    expect(whiteOnAccentInline(`<b style={{ background: 'var(--accent)', color: '#fff' }} />`)).toHaveLength(1);
    expect(whiteOnAccentInline(`const s = { background: on ? 'var(--accent)' : 'none', color: on ? 'white' : 'var(--text)' };`)).toHaveLength(1);
    expect(whiteOnAccentInline(`<b style={{ background: 'var(--accent)', color: 'var(--on-accent)' }} />`)).toEqual([]);
    expect(whiteOnAccentInline(`<b style={{ background: 'var(--accent-soft)', color: '#fff' }} />`)).toEqual([]);
    expect(whiteOnAccentInline(`<b style={{ background: 'var(--accent)', borderColor: '#fff' }} />`)).toEqual([]);
  });
});

// --accent-hot (#c8553d) — декор: белый на нём 4.36:1, чернила 4.27:1, оба ниже AA 4.5:1.
// Логотип «В» и плашки «рекомендуем»/«−N%» стояли на нём белым (docs/open/frontend-ux.md,
// 2026-11) — переведены на --accent + --on-accent.
describe('на заливке --accent-hot текста нет', () => {
  it.each(files)('%s: заливка --accent-hot без цвета текста', (f) => {
    expect(textOnHot(readFileSync(join(SRC, f), 'utf8'))).toEqual([]);
  });

  it('контрольный образец: сверка видит текст на --accent-hot', () => {
    expect(textOnHot('.x { background: var(--accent-hot); color: var(--on-accent); }')).toEqual(['.x']);
    expect(textOnHot('.y { background: var(--accent-hot); opacity: .6; }')).toEqual([]);
  });
});
