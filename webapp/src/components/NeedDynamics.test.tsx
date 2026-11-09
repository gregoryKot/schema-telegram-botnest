// @vitest-environment jsdom
// «Динамика потребности»: направление недели, спарклайн цветом данных и строка детства —
// только из реальных данных (нет детства — нет строки и пунктира; один день — без графика).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NeedDynamics } from './NeedDynamics';
import type { DayHistory } from '../types';

const day = (date: string, v: number) => ({ date, ratings: { play: v } }) as unknown as DayHistory;
const WEEK = [day('2026-11-08', 8), day('2026-11-07', 8), day('2026-11-06', 8), day('2026-11-05', 4), day('2026-11-04', 4), day('2026-11-03', 4)];

describe('NeedDynamics', () => {
  it('неделя: направление, разница и спарклайн; с детством — пунктир, подпись легендой и строка со знаком колеса', () => {
    const { container } = render(<NeedDynamics needId="play" history={WEEK} childhoodValue={3} />);
    expect(screen.getByText('↑ Растёт')).toBeTruthy();
    expect(screen.getByText('+4.0 к предыдущей неделе')).toBeTruthy();
    expect(container.querySelector('svg.tk2-chart .tk2-line')).not.toBeNull();
    expect(container.querySelector('svg.tk2-chart .tk2-ref')).not.toBeNull();
    expect(screen.getByText('детство 3')).toBeTruthy();
    expect(container.querySelector('.tk2-child .pp-row-art svg')).not.toBeNull();
    expect(screen.getByText(/сейчас 8\.0/)).toBeTruthy();
  });

  it('без детства — ни пунктира, ни строки детства', () => {
    const { container } = render(<NeedDynamics needId="play" history={WEEK} />);
    expect(container.querySelector('.tk2-ref')).toBeNull();
    expect(container.querySelector('.tk2-child')).toBeNull();
    expect(screen.queryByText(/детство/)).toBeNull();
  });

  it('один день — без графика и без подписи пунктира', () => {
    const { container } = render(<NeedDynamics needId="play" history={[day('2026-11-08', 6)]} childhoodValue={3} />);
    expect(container.querySelector('svg.tk2-chart')).toBeNull();
    expect(screen.queryByText('детство 3')).toBeNull();
  });
});
