// @vitest-environment jsdom
// «Индекс сегодня» в сайдбаре «Обзора»: столбики — только при ≥3 днях истории,
// отличие от недели — только при ≥7 (weekDelta); на короткой истории карточка
// показывает одно число, ничего не выдумывая. Светофора нет (b30): число и дельта
// не красятся в красный/зелёный — как индекс у клиента на «Готово» трекера.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ClientIndexCard } from './ClientIndexCard';

afterEach(cleanup);

const day = (index: number | null) => ({ index });

describe('ClientIndexCard', () => {
  it('история короче трёх дней — число без столбиков и дельты', () => {
    const { container } = render(<ClientIndexCard todayIndex={7.2} history={[day(7.2), day(6)]} />);
    expect(screen.getByText('Индекс сегодня').className).toContain('ds-label');
    expect(screen.getByText('7,2').className).toBe('tk-index-num');
    expect(container.querySelector('.ds-spark')).toBeNull();
    expect(screen.queryByText(/к нед\./)).toBeNull();
  });

  it('семь дней истории — столбики по дням и отличие от среднего за неделю', () => {
    const history = [day(8), day(6), day(6), day(6), day(6), day(6), day(6)];
    const { container } = render(<ClientIndexCard todayIndex={8} history={history} />);
    expect(container.querySelectorAll('.ds-spark > i').length).toBe(7);
    expect(screen.getByText('7 дн.').className).toContain('ds-sub');
    expect(screen.getByText('+2,0 к нед.').className).toBe('tk-delta');
  });

  it('ниже недели — дельта с минусом и десятичной запятой, тем же тихим цветом', () => {
    const history = [day(4.5), day(6), day(6), day(6), day(6), day(6), day(6)];
    render(<ClientIndexCard todayIndex={4.5} history={history} />);
    expect(screen.getByText('4,5')).toBeTruthy();
    expect(screen.getByText(/^−\d,\d к нед\.$/).className).toBe('tk-delta');
  });

  it('пропущенный день — пустой паз, а не ноль высотой столбика; светофорных классов нет', () => {
    const history = [day(8), day(null), day(6)];
    const { container } = render(<ClientIndexCard todayIndex={8} history={history} />);
    const bars = Array.from(container.querySelectorAll('.ds-spark > i'));
    expect(bars.map(b => b.className)).toEqual(['', 'is-none', '']);
    expect(container.querySelector('[class*="ds-idx-"], .is-ok, .is-warn, .is-err')).toBeNull();
  });
});
