// Лист `position: fixed` внутри `position: sticky` живёт в контексте наложения предка и ложится под его соседей;
// check-overlay-stack этого не видит. Классы липких — из исходников CSS: их читает тест (здесь без node:fs — модуль в сборке tsc).
export type CssRuleLike = { selectors: string[]; body: string }; // правило CSS в разборе, как Rule из cssRules.test-helpers

/** Классы, на которых какое-нибудь правило ставит `position: sticky` (в том числе под @media):
 *  класс последнего составного селектора каждой ветки. */
export function stickyClasses(rules: CssRuleLike[]): Set<string> {
  const found = new Set<string>();
  for (const r of rules) {
    if (!/(^|[;\s])position\s*:\s*sticky\b/.test(r.body)) continue;
    for (const sel of r.selectors) {
      const last = sel.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? '';
      for (const c of last.matchAll(/\.([\w-]+)/g)) found.add(c[1]);
    }
  }
  return found;
}

/** Предки элемента с классом из `sticky` — от ближнего к дальнему, как «тег.класс». */
export function stickyAncestorsOf(el: Element, sticky: Set<string>): string[] {
  const out: string[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const hit = [...p.classList].find((c) => sticky.has(c));
    if (hit) out.push(`${p.tagName.toLowerCase()}.${hit}`);
  }
  return out;
}

/** Лист, открытый тапом из колонки разворота (aside, heroFoot) или липкой полосы, — проверка в его `*.sticky.test.tsx`:
 *  липкие предки открывающего (`from`, до тапа) и листа (`sheet`: [] — образец, null — не открылся). */
export function openFromSticky(opener: Element, tap: (el: Element) => unknown, sheetOf: () => Element | null, sticky: Set<string>) {
  const from = stickyAncestorsOf(opener, sticky);
  tap(opener);
  const sheet = sheetOf();
  return { from, sheet: sheet && stickyAncestorsOf(sheet, sticky) };
}
