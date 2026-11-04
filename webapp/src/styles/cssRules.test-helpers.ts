// Помощники сверок раскладки по исходникам css (CSS в jsdom не исполняется): разбор правил с медиа-контекстом.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Rule = { media: string; selectors: string[]; body: string; f?: string };

/** Правила со своим медиа-контекстом ('' — вне @media). Один уровень вложенности — как во всех css пакета. */
export function parseRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const walk = (text: string, media: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      for (; j < text.length && depth > 0; j++) depth += text[j] === '{' ? 1 : text[j] === '}' ? -1 : 0;
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith('@media')) walk(inner, head);
      else if (!head.startsWith('@')) out.push({ media, selectors: head.split(',').map((s) => s.trim()), body: inner });
      i = j;
    }
  };
  walk(src, '');
  return out;
}

/** Только точный блок телефона: блок касаний `(pointer: coarse), (max-width: 767px)` телефонным не считается (iPad ≥768). */
export const isPhone = (m: string) => /^@media\s*\(max-width:\s*767px\)$/.test(m.trim());
export const isTouch = (m: string) => /pointer:\s*coarse/.test(m);
export const isDesktop = (m: string) => /min-width:\s*768px/.test(m);

/** Объявление у селектора вне телефонного блока и вне ≥768 (включая блок касаний) — нарушение. */
export function unscopedPhone(rules: Rule[], selector: string, decl: RegExp): string[] {
  return rules
    .filter((r) => r.selectors.includes(selector) && !isPhone(r.media) && !isDesktop(r.media) && decl.test(r.body))
    .map((r) => `${r.media || '(без медиа)'} ${selector} { ${r.body.trim()} }`);
}

/** Есть правило под ≥768 с точно таким селектором (exact) или содержащим его (по умолчанию). */
export const hasDesktopRule = (rules: Rule[], selector: string, exact = false): boolean =>
  rules.some((r) => isDesktop(r.media) && r.selectors.some((s) => (exact ? s === selector : s.includes(selector))));

export const cssDir = __dirname;
export const readCss = (name: string): Rule[] => parseRules(readFileSync(join(cssDir, name), 'utf8')).map((r) => ({ ...r, f: name }));
export const allCssRules = (): Rule[] => readdirSync(cssDir).filter((f) => f.endsWith('.css')).flatMap(readCss);
export const indexCssRules = (): Rule[] => parseRules(readFileSync(join(cssDir, '..', 'index.css'), 'utf8'));

/** Относительные пути не-тестовых .tsx под каталогом, где встречается подстрока. */
export function tsxUsing(root: string, needle: string, base = root): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((e) => {
    const p = join(root, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : tsxUsing(p, needle, base);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) && readFileSync(p, 'utf8').includes(needle) ? [p.slice(base.length + 1)] : [];
  });
}
