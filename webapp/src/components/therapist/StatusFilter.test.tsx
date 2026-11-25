// @vitest-environment jsdom
// Фильтр статуса на «Клиентах» (#1674, К4): тихий текстовый переключатель LineTabs, а не коробки-чипы.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StatusFilter } from './StatusFilter';

afterEach(cleanup);

describe('StatusFilter', () => {
  it('tablist «Статус»: выбранный — aria-selected, без чипов ds-chip', () => {
    const { container } = render(<StatusFilter value="wait" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist', { name: 'Статус' }).className).toContain('lt-quiet--mark');
    const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected.map((t) => t.textContent)).toEqual(['Не сегодня']);
    expect(container.querySelector('.ds-chip')).toBeNull();
  });

  it('тап и стрелка выбирают статус', () => {
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Офлайн' }));
    expect(onChange).toHaveBeenLastCalledWith('virtual');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Все' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('active');
  });
});
