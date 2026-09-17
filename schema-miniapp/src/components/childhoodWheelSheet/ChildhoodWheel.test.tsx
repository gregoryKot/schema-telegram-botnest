// @vitest-environment jsdom
// ChildhoodWheel — радар-диаграмма колеса детства (0% покрытия): чистый SVG
// без сети/стейта, так что тест проверяет что реально нарисовано — по точке
// и подписи-значению на каждую из 5 потребностей, без крашей на краевых 0/10.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ChildhoodWheel } from './ChildhoodWheel';
import { NEED_IDS, type Ratings } from './types';

afterEach(cleanup);

function ratings(overrides: Partial<Ratings> = {}): Ratings {
  return {
    attachment: 5,
    autonomy: 5,
    expression: 5,
    play: 5,
    limits: 5,
    ...overrides,
  };
}

describe('ChildhoodWheel', () => {
  it('рисует по одной подписи-значению на каждую из 5 потребностей', () => {
    const { container } = render(
      <ChildhoodWheel
        ratings={ratings({
          attachment: 2,
          autonomy: 4,
          expression: 6,
          play: 8,
          limits: 10,
        })}
      />,
    );
    const texts = Array.from(container.querySelectorAll('text')).map(
      (t) => t.textContent,
    );
    expect(texts).toEqual(['2', '4', '6', '8', '10']);
  });

  it('рисует 5 осевых линий и 5 точек значения (по одной на потребность)', () => {
    const { container } = render(<ChildhoodWheel ratings={ratings()} />);
    expect(container.querySelectorAll('line').length).toBe(NEED_IDS.length);
    // 2 круга на потребность: точка значения + опознавательный знак оси
    expect(container.querySelectorAll('circle').length).toBe(
      NEED_IDS.length * 2,
    );
  });

  it('крайние значения (все 0 и все 10) не падают и остаются в SVG', () => {
    const zero = render(
      <ChildhoodWheel
        ratings={ratings({
          attachment: 0,
          autonomy: 0,
          expression: 0,
          play: 0,
          limits: 0,
        })}
      />,
    );
    expect(zero.container.querySelector('svg')).toBeTruthy();
    cleanup();
    const max = render(
      <ChildhoodWheel
        ratings={ratings({
          attachment: 10,
          autonomy: 10,
          expression: 10,
          play: 10,
          limits: 10,
        })}
      />,
    );
    expect(max.container.querySelector('svg')).toBeTruthy();
  });
});
