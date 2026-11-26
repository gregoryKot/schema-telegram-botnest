// Контракт сцены для тестов (docs/design/PAPER_2026-11.md, «Сцены»): любая новая сцена партии
// сверяется одной строкой — `expectSceneContract(<SceneX … />)` — и не правит общий
// LandingScenes.test.tsx. Что ломается молча и что здесь держим:
//  • сцена — декор: svg.scn скрыт от чтения с экрана, оттенок бумаги уходит в --h;
//  • глубина — сдвинутый сплошной слой (.scn-shade с фигурами), а не filter/blur;
//  • лист-подложка с нижним слоем лежит в холсте с равными полями слева и справа;
//  • цвета — только токены (var(--…), color-mix от них), без hex и rgb;
//  • пусто — без выдуманных фигур: `expectEmptyScene(<SceneX count={0} />, '[data-sheet]')`.
import type { ReactElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { expect } from 'vitest';

const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

/** Значение fill/stroke: none или токен. */
function isTokenPaint(value: string): boolean {
  return value === 'none' || (/var\(--[a-z0-9-]+\)/i.test(value) && !LITERAL_COLOR.test(value));
}

/** Проверяет контракт сцены; `shade: false` — у сцены законно нет приподнятых фигур. */
export function expectSceneContract(ui: ReactElement, { shade = true }: { shade?: boolean } = {}): void {
  const { container } = render(ui);
  const svgs = [...container.querySelectorAll('svg.scn')] as SVGSVGElement[];
  expect(svgs.length, 'сцена рисует svg.scn').toBeGreaterThan(0);
  for (const svg of svgs) {
    expect(svg.getAttribute('aria-hidden'), 'сцена — декор').toBe('true');
    expect(svg.style.getPropertyValue('--h'), 'оттенок бумаги в --h').not.toBe('');
    expect(svg.querySelector('filter, [filter], [style*="filter"]'), 'без фильтров и размытия').toBeNull();
    for (const el of svg.querySelectorAll('[fill], [stroke]')) {
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr);
        if (v !== null) expect(isTokenPaint(v), `${el.tagName} ${attr}="${v}" — цвет токеном`).toBe(true);
      }
    }
    const top = svg.querySelector(':scope > .scn-sheet');
    const under = svg.querySelector(':scope > .scn-sheet-under');
    if (top && under) {
      const left = Number(top.getAttribute('x'));
      const right = 320 - Number(under.getAttribute('x')) - Number(under.getAttribute('width'));
      expect(left, 'равные поля холста').toBe(right);
    }
  }
  if (shade) {
    const layers = [...container.querySelectorAll('.scn-shade')];
    expect(layers.some((g) => g.children.length > 0), 'тень — сдвинутый слой фигур').toBe(true);
  }
  expect(container.querySelector('.scn-blob'), 'без пятен-клякс').toBeNull();
  cleanup();
}

/** Пустая сцена: фигур-данных (`dataSelector`) нет ни в рисунке, ни в его тени. */
export function expectEmptyScene(ui: ReactElement, dataSelector: string): void {
  const { container } = render(ui);
  expect(container.querySelector('svg.scn'), 'пустая сцена всё равно рисуется').not.toBeNull();
  expect(container.querySelectorAll(dataSelector).length, `пусто — без «${dataSelector}»`).toBe(0);
  cleanup();
}
