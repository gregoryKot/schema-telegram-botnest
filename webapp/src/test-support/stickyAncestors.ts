// Липкий предок у полноэкранного листа (ревью g3 r2, «Сравни с похожими» на развороте ≥1024).
//
// Лист `position: fixed; z-index: 200`, отрисованный внутри элемента с `position: sticky`, живёт
// в контексте наложения этого предка: sticky создаёт свой контекст, и весь лист оказывается ниже
// соседа предка с любым z-index (липкая шапка мастера `.ex2-top`, z 2). В DOM лист на месте, тап
// попадает в чужую кнопку «Назад». check-overlay-stack сравнивает только числа z-index — эту
// ловушку он не видит, а jsdom CSS не исполняет. Поэтому классы липких элементов берутся из
// правил исходников стилей (тест читает их через styles/cssRules.test-helpers: allCssRules и
// indexCssRules), а тест листа проверяет его предков в DOM. Здесь без node:fs — модуль в сборке tsc.

/** Правило CSS в разборе: селекторы через запятую и тело (как Rule из cssRules.test-helpers). */
export type CssRuleLike = { selectors: string[]; body: string };

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
