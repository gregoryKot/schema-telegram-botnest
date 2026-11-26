// @vitest-environment jsdom
// Знак-герой благодарности: камешков легло столько, сколько пунктов записано (решение 2,
// docs/design/APP_2026-11.md) — данные, а не украшение; пустой день — ни одного окрашенного.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GratitudePebbles } from './GratitudePebbles';

/** Верхний слой знака (второй svg в .scn-sign) — то, что видит человек; первый — тень-вырезка. */
const laid = (filled: number) => {
  const { container } = render(<GratitudePebbles filled={filled} />);
  const top = container.querySelectorAll('.scn-sign > svg')[1];
  return {
    yes: top.querySelectorAll('[data-laid="yes"]').length,
    no: top.querySelectorAll('[data-laid="no"]').length,
    root: container.querySelector('.scn-sign'),
  };
};

describe('GratitudePebbles', () => {
  it('легло столько камешков, сколько пунктов; остальные ждут', () => {
    expect(laid(0)).toMatchObject({ yes: 0, no: 3 });
    expect(laid(2)).toMatchObject({ yes: 2, no: 1 });
  });

  it('больше трёх пунктов — три камешка; отрицательное — ноль', () => {
    expect(laid(5)).toMatchObject({ yes: 3, no: 0 });
    expect(laid(-1)).toMatchObject({ yes: 0, no: 3 });
  });

  it('декор скрыт от чтения с экрана и несёт класс, по которому у пустых камешков нет тени', () => {
    const { root } = laid(1);
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.classList.contains('sd-grat-pebbles')).toBe(true);
  });
});
