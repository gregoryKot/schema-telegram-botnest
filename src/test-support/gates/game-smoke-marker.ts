// Маркер игры в шаге `/game/` смока прода (prod-smoke.yml) сверяется с
// game/index.html: SPA-fallback отдаёт 200 с HTML сайта на любой путь, и игру
// от сайта отличает только маркер. Он обязан быть в игре и отсутствовать на
// сайте (webapp/index.html). Образцы и прогон по файлам — game-smoke-marker.spec.ts.
import { jobBody, runBlock, stepName, steps } from '../workflow-steps';

/** Фиксированная строка из `grep -qF '…'` шага `/game/` смока прода. */
export function gameSmokeMarker(yml: string): string {
  const step = steps(jobBody(yml, 'prod-smoke')).find((s) =>
    stepName(s).startsWith('/game/'),
  );
  if (!step) throw new Error('в prod-smoke.yml нет шага «/game/ …»');
  const script = runBlock(step)
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const m = /grep -qF '([^']+)'/.exec(script);
  if (!m) {
    throw new Error(
      "шаг «/game/» должен искать маркер как `grep -qF '…'` (фиксированная строка, без regex)",
    );
  }
  return m[1];
}

/** Что не так с маркером: пусто — всё в порядке. */
export function gameMarkerProblems(
  marker: string,
  gameHtml: string,
  siteHtml: string,
): string[] {
  const problems: string[] = [];
  if (!gameHtml.includes(marker)) {
    problems.push(
      `маркера ${marker} нет в game/index.html: смок прода покраснеет на здоровом проде`,
    );
  }
  if (siteHtml.includes(marker)) {
    problems.push(
      `маркер ${marker} есть в webapp/index.html: SPA-fallback сайта пройдёт за игру`,
    );
  }
  return problems;
}
