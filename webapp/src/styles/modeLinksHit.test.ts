// @vitest-environment node
// Ссылки внизу листа-героя формы режима («Сменить режим», «Сравни с похожими», ModeEntryForm heroFoot): строка
// 24, зона 44 — прозрачный ::before. Ревью g3 r3: на 320–375 ссылки встают в две строки через 4px, зоны ±10
// перекрывались на 16px, ::before нижней лежал поверх нижней трети верхней — тап по «Сменить режим» открывал
// лист сравнения. check-tap-targets видит только min-height. CSS в jsdom не исполняется — сверяем исходник:
// строка + две выноски ≥ 44, а выноски двух соседей (по вертикали и по горизонтали) не длиннее зазора.
import { describe, it, expect } from 'vitest';
import { readCss, type Rule } from './cssRules.test-helpers';

const rules = readCss('diary-mode.css');
const LINK = '.ds-link.sd-mode-link';

const px = (body: string, prop: string): number[] | null => {
  const m = body.match(new RegExp(`(?:^|[;\\s{])${prop}:\\s*([-\\d.px\\s]+?)\\s*(?:;|$)`));
  return m ? m[1].trim().split(/\s+/).map((v) => Number.parseFloat(v)) : null;
};
/** Последнее значение свойства у селектора в медиа-контексте (каскад: позднее правило побеждает) или вне медиа. */
const last = (sel: string, prop: string, media: string): number[] | null => {
  const pick = (ctx: string) => rules.filter((r: Rule) => r.media === ctx && r.selectors.includes(sel))
    .map((r) => px(r.body, prop)).filter((v): v is number[] => v !== null).pop() ?? null;
  return (media && pick(media)) || pick('');
};

/** Зазор между строками и колонками: `gap: R C` / `gap: R`, поверх — `row-gap` и `column-gap`. */
function gaps(media: string): { row: number; col: number } {
  const g = last('.sd-mode-links', 'gap', media) ?? [0];
  return {
    row: (last('.sd-mode-links', 'row-gap', media) ?? [g[0]])[0],
    col: (last('.sd-mode-links', 'column-gap', media) ?? [g[1] ?? g[0]])[0],
  };
}

const contexts = ['', ...new Set(rules.filter((r) => r.media && r.selectors.some((s) => s.includes('sd-mode-link'))).map((r) => r.media))]
  .map((m) => [m || 'вне медиа', m] as const);

describe('ссылки формы режима — зоны 44 без перекрытия при переносе', () => {
  it('ссылка — строка ≥24 с ::before, зона по высоте ≥44', () => {
    const h = last(LINK, 'min-height', '')![0];
    const [v] = last(`${LINK}::before`, 'inset', '')!;
    expect(h).toBeGreaterThanOrEqual(24);
    expect(v).toBeLessThan(0);
    expect(h - 2 * v).toBeGreaterThanOrEqual(44);
  });

  it.each(contexts)('%s: выноски соседей не длиннее зазора строк и колонок', (_name, media) => {
    const [v, hz = v] = last(`${LINK}::before`, 'inset', media)!;
    const { row, col } = gaps(media);
    expect(-2 * v, `строки: выноски ${-v}+${-v} > row-gap ${row}`).toBeLessThanOrEqual(row);
    expect(-2 * hz, `колонки: выноски ${-hz}+${-hz} > column-gap ${col}`).toBeLessThanOrEqual(col);
  });
});
