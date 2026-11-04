// @vitest-environment jsdom
// SparklineRow — мини-график потребности за период. Проверяет вычисление
// тренда (стрелка вверх/вниз/ровно) по разнице сегодня-вчера и что рендер
// не падает при истории из одного дня (n=1 — деление на 0 в шаге по X).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SparklineRow } from './SparklineRow';
import type { DayHistory, Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEED: Need = {
  id: 'attachment',
  emoji: '💙',
  title: 'Привязанность',
  chartLabel: 'Привязанность',
};

function makeHistory(scores: number[]): DayHistory[] {
  // Окно дней (weekWindow): [0] — выбранный, самый свежий день
  return scores.map((v, i) => ({
    date: `2026-08-${String(10 - i).padStart(2, '0')}`,
    ratings: { attachment: v },
  }));
}

describe('SparklineRow — тренд относительно предыдущего дня', () => {
  it('оценка выросла — стрелка вверх, зелёный цвет', () => {
    const history = makeHistory([8, 5, 5]); // [сегодня, вчера, позавчера]
    render(
      <SparklineRow
        need={NEED}
        days={history}
        selectedRatings={{ attachment: 8 }}
      />,
    );
    expect(screen.getByText('↑')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('оценка упала — стрелка вниз', () => {
    const history = makeHistory([3, 7, 5]);
    render(
      <SparklineRow
        need={NEED}
        days={history}
        selectedRatings={{ attachment: 3 }}
      />,
    );
    expect(screen.getByText('↓')).toBeTruthy();
  });

  it('без изменений — прочерк', () => {
    const history = makeHistory([5, 5, 5]);
    render(
      <SparklineRow
        need={NEED}
        days={history}
        selectedRatings={{ attachment: 5 }}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('SparklineRow — устойчивость к краям данных', () => {
  it('единственный день истории — не падает (n=1, деление на 0 в шаге X)', () => {
    const history = makeHistory([6]);
    expect(() =>
      render(
        <SparklineRow
          need={NEED}
          days={history}
          selectedRatings={{ attachment: 6 }}
        />,
      ),
    ).not.toThrow();
  });

  it('клик по строке вызывает onClick', () => {
    const onClick = vi.fn();
    const history = makeHistory([5, 5]);
    render(
      <SparklineRow
        need={NEED}
        days={history}
        selectedRatings={{ attachment: 5 }}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});

// QA 2026-11 (B-М4): круг-маркер внутри svg с preserveAspectRatio="none"
// сплющивался в овал — теперь это HTML-точка поверх графика.
describe('SparklineRow — маркер выбранного дня', () => {
  it('точка — не круг в растянутом svg, а элемент справа по процентам', () => {
    const { container } = render(
      <SparklineRow
        need={NEED}
        days={makeHistory([8, 5, 5])}
        selectedRatings={{ attachment: 8 }}
      />,
    );
    expect(container.querySelector('svg circle')).toBeNull();
    const dot = [...container.querySelectorAll<HTMLElement>('span')].find(
      (el) => el.style.left === '100%',
    );
    expect(dot).toBeTruthy();
  });
});
