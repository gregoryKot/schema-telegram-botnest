// @vitest-environment node
// Статус-бар телефона (#902): в установленном с сайта приложении (standalone,
// viewport-fit=cover) содержимое уходило под статус-бар — --safe-top был жёстким
// 0px, env(safe-area-inset-top) никто не читал, а хук Telegram/MAX ещё и писал
// 0px инлайн. CSS в jsdom не исполняется, поэтому пинаем строки исходника (приём
// touch-fixes.css.test.ts): как считается --safe-top, какую переменную пишет
// хук, и что .app-shell и каждый корень полноэкранного листа отступают на телефоне.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_MEDIA } from '../utils/phoneLayout';

const SRC = join(__dirname, '..');
const read = (f: string) => readFileSync(join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Тела всех блоков `@media <PHONE_MEDIA> { … }` файла, склеенные. */
function phoneBlocks(css: string, media = `@media ${PHONE_MEDIA}`): string {
  const out: string[] = [];
  const re = new RegExp(`${media.replace(/[()]/g, '\\$&')}\\s*\\{`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const start = m.index + m[0].length;
    let i = start;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

/** Есть ли правило, в списке селекторов которого стоит `cls`, а в теле — `decl`. */
function hasRule(block: string, cls: string, decl: string): boolean {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.includes(cls) && m[2].includes(decl)) return true;
  }
  return false;
}

// Корни полноэкранных листов сайта (position: fixed; inset: 0 — grep по
// styles/*.css и index.css). Подложки модалок и поповеров (.sheet-modal,
// .cmd-backdrop, .sk-dialog-backdrop, .ds-backdrop) сюда не входят: их
// содержимое не у верхней кромки. У экрана упражнения
// отступ стоит на липкой шапке .ex2-top, а не на корне: sticky top: 0
// считается от края скролл-контейнера, и padding корня уезжает при скролле.
// Третий элемент: кто несёт отступ вместо корня (липкая шапка).
const OVERLAY_ROOTS: [string, string[], Record<string, string>?][] = [
  ['styles/sheet-settings.css', ['.st-overlay']],
  ['styles/sheet-exercises.css', ['.ex2-screen'], { '.ex2-screen': '.ex2-top' }],
  ['styles/sheet-schemas.css', ['.ss-sheet', '.ss-test']],
  ['styles/sheet-tracker.css', ['.tk2-overlay']],
  ['styles/sheet-tasks.css', ['.sk-sheet', '.sk-overlay', '.sk-priv']],
  ['styles/client-schemas.css', ['.cs-sheet']],
  ['index.css', ['.ex-screen']],
];

describe('безопасная зона сверху (--safe-top)', () => {
  it(':root считает --safe-top как max() из env(safe-area-inset-top) и переменной хоста', () => {
    const decl = read('index.css').match(/:root\s*\{[^}]*--safe-top:\s*([^;]+);/)?.[1] ?? '';
    expect(decl).toMatch(/^max\(/);
    expect(decl).toContain('env(safe-area-inset-top');
    expect(decl).toContain('var(--host-safe-top');
  });

  it('хук Telegram/MAX пишет --host-safe-top, а не --safe-top (инлайн-0px затирал бы env())', () => {
    const hook = read('hooks/useHostSafeTop.ts');
    expect(hook).toContain("'--host-safe-top'");
    expect(hook).not.toContain("'--safe-top'");
  });

  it('на телефоне .app-shell отступает на --safe-top', () => {
    expect(hasRule(phoneBlocks(read('index.css')), '.app-shell', 'padding-top: var(--safe-top)')).toBe(true);
  });

  it.each(OVERLAY_ROOTS)('%s: корни полноэкранных листов отступают на --safe-top на телефоне', (file, roots, paddedBy = {}) => {
    const css = read(file);
    const phone = phoneBlocks(css);
    for (const root of roots) {
      expect(css, `${root} — корень на весь экран`).toMatch(new RegExp(`${root.replace('.', '\\.')}\\s*\\{[^}]*position: fixed; inset: 0`));
      const carrier = paddedBy[root] ?? root;
      expect(hasRule(phone, carrier, 'padding-top: var(--safe-top)'), `${carrier} в ${file}`).toBe(true);
      if (carrier !== root) {
        // Липкая шапка: sticky top: 0 считается от края скролл-контейнера, и
        // padding корня уехал бы при первом скролле — отступ только на шапке.
        expect(css, `${carrier} — липкая шапка`).toMatch(new RegExp(`${carrier.replace('.', '\\.')}\\s*\\{[^}]*position: sticky; top: 0`));
        expect(hasRule(phone, root, 'padding-top: var(--safe-top)'), `${root} не должен нести отступ`).toBe(false);
      }
    }
  });

  it('shared/utilities.css: на телефоне .u-sheet и .u-sheet-grid отступают на --safe-top', () => {
    const css = readFileSync(join(__dirname, '..', '..', '..', 'shared/src/theme/utilities.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const phone = phoneBlocks(css);
    expect(hasRule(phone, '.u-sheet.u-sheet', 'padding-top: var(--safe-top')).toBe(true);
    expect(hasRule(phone, '.u-sheet-grid.u-sheet-grid', 'padding-top: var(--safe-top')).toBe(true);
  });

  // C-З9: страницы вне AppShell (/account, /subscribe, /donate) в установленном
  // приложении стояли под статус-баром — корень не отступал.
  it.each([['styles/auth-account.css', '.aa-root'], ['styles/auth-pay.css', '.ap-page']])(
    '%s: корень страницы %s отступает на --safe-top', (file, root) => {
      const css = read(file);
      expect(hasRule(css, root, 'padding-top: var(--safe-top)'), `${root} в ${file}`).toBe(true);
    });

  // Инлайн-корни (style={{ position: 'fixed', inset: 0 }} в .tsx) сверка CSS выше не видит:
  // шапка «На весь экран» схемы и мобильные меню лендингов уходили под статус-бар.
  // Слой без касаний (pointerEvents: 'none') — декор-подложка, не лист: его не считаем.
  it('инлайн-корни на весь экран в .tsx отступают на --safe-top', () => {
    const roots = tsxFiles().flatMap((f) => inlineOverlayRoots(readFileSync(f, 'utf8')).map((o) => ({ f, o })));
    const sheets = roots.filter(({ o }) => !o.includes("pointerEvents: 'none'"));
    expect(sheets.length, 'скан нашёл инлайн-листы').toBeGreaterThanOrEqual(3);
    expect(sheets.filter(({ o }) => !o.includes('--safe-top')).map(({ f }) => f)).toEqual([]);
  });

  it('контрольный образец: скан видит инлайн-корень без --safe-top', () => {
    const [o] = inlineOverlayRoots("<div style={{ position: 'fixed', inset: 0, zIndex: 9 }}><i style={{ a: 1 }} /></div>");
    expect(o).toBe("{ position: 'fixed', inset: 0, zIndex: 9 }");
    expect(inlineOverlayRoots("<div style={{ position: 'fixed', top: 0 }} />")).toEqual([]);
  });
});

/** Исходники .tsx сайта и shared без тестов. */
function tsxFiles(): string[] {
  return [SRC, join(SRC, '..', '..', 'shared', 'src')].flatMap((dir) =>
    (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
      .map((f) => join(dir, f)));
}

/** Объекты стиля с `position: 'fixed', inset: 0` — текст от `{` до парной `}`. */
function inlineOverlayRoots(src: string): string[] {
  const out: string[] = [];
  const re = /position:\s*'fixed',\s*inset:\s*0\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = src.lastIndexOf('{', m.index);
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    out.push(src.slice(open, i + 1));
  }
  return out;
}
