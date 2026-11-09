// @vitest-environment jsdom
// «Динамика потребности»: направление недели, спарклайн цветом данных и строка детства —
// только из реальных данных (нет детства — нет строки и пунктира; один день — без графика
// и без сравнения с прошлой неделей). Сверка недели с «Неделей» истории через шов —
// HistoryView.dynamics.test.tsx.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NeedDynamics } from './NeedDynamics';
import type { DayHistory } from '../types';

const day = (date: string, v?: number) => ({ date, ratings: v ? { play: v } : {} }) as unknown as DayHistory;
// Две недели от новых к старым: эта по 8, прошлая по 4.
const TWO_WEEKS = Array.from({ length: 14 }, (_, i) => day(`2026-11-${String(14 - i).padStart(2, '0')}`, i < 7 ? 8 : 4));

afterEach(() => cleanup());

describe('NeedDynamics', () => {
  it('неделя против прошлой: направление, разница и спарклайн; с детством — пунктир, подпись и строка со знаком колеса', () => {
    const { container } = render(<NeedDynamics needId="play" history={TWO_WEEKS} childhoodValue={3} />);
    expect(screen.getByText('↑ Растёт')).toBeTruthy();
    expect(screen.getByText('+4,0 к предыдущей неделе')).toBeTruthy();
    expect(container.querySelector('svg.tk2-chart .tk2-line')).not.toBeNull();
    expect(container.querySelector('svg.tk2-chart .tk2-ref')).not.toBeNull();
    expect(screen.getByText('детство 3')).toBeTruthy();
    expect(container.querySelector('.tk2-child .pp-row-art svg')).not.toBeNull();
    expect(screen.getByText(/сейчас 8,0/)).toBeTruthy();
  });

  it('без детства — ни пунктира, ни строки детства', () => {
    const { container } = render(<NeedDynamics needId="play" history={TWO_WEEKS} />);
    expect(container.querySelector('.tk2-ref')).toBeNull();
    expect(container.querySelector('.tk2-child')).toBeNull();
    expect(screen.queryByText(/детство/)).toBeNull();
  });

  it('один день — без графика, без подписи пунктира и без «+0,0 к предыдущей неделе»', () => {
    const { container } = render(<NeedDynamics needId="play" history={[day('2026-11-08', 6)]} childhoodValue={3} />);
    expect(container.querySelector('svg.tk2-chart')).toBeNull();
    expect(screen.queryByText('детство 3')).toBeNull();
    expect(screen.queryByText(/к предыдущей неделе/)).toBeNull();
    expect(screen.getByText('→ Стабильно')).toBeTruthy();
  });

  it('пустые дни не занижают «сейчас»: среднее — по дням с оценкой', () => {
    const gappy = [day('2026-11-08', 6), day('2026-11-07'), day('2026-11-06', 6), day('2026-11-05')];
    render(<NeedDynamics needId="play" history={gappy} childhoodValue={3} />);
    expect(screen.getByText(/сейчас 6,0/)).toBeTruthy();
  });

  it('в неделе нет ни одной оценки — ни направления, ни «сейчас», ни линии', () => {
    const { container } = render(<NeedDynamics needId="play" history={[day('2026-11-08'), day('2026-11-07')]} childhoodValue={3} />);
    expect(screen.queryByText(/Растёт|Падает|Стабильно/)).toBeNull();
    expect(screen.queryByText(/сейчас/)).toBeNull();
    expect(container.querySelector('svg.tk2-chart')).toBeNull();
  });
});
