// @vitest-environment jsdom
// Лист дня: лепестки колеса — цвет данных потребности (needDataColor, решение 7 «Палитра данных»),
// тот же, что у шкалы трекера, столбиков «Готово» и линий «Недели»; второй палитры в колесе нет.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DayWheel } from './DayWheel';
import { needDataColor } from '../needDataColor';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import type { Need } from '../../types';

const NEEDS = NEED_ORDER.map((id) => ({ id, emoji: '', title: id, chartLabel: id })) as Need[];
const RATINGS = Object.fromEntries(NEED_ORDER.map((id) => [id, 7]));

describe('DayWheel', () => {
  it('каждый лепесток красится needDataColor своей потребности', () => {
    const { container } = render(
      <DayWheel date="2026-11-09" needs={NEEDS} ratings={RATINGS} prevRatings={{}} childhoodRatings={{}}
        onTapNeed={vi.fn()} onIndexInfo={vi.fn()} />,
    );
    for (const id of NEED_ORDER) {
      expect(container.querySelector(`path[data-petal="${id}"]`)!.getAttribute('fill')).toBe(needDataColor(id));
    }
  });
});
