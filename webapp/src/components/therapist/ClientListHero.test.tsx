// @vitest-environment jsdom
// Шапка «Клиенты»: счётчик только при клиентах, кнопка знает, открыта ли форма; кнопка — текст на линии.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientListHero } from './ClientListHero';

describe('ClientListHero', () => {
  it('без клиентов счётчика нет, с клиентами — число', () => {
    const { rerender, container } = render(<ClientListHero count={0} formVisible={false} onToggle={() => {}} />);
    expect(container.querySelector('.tc-count')).toBeNull();
    rerender(<ClientListHero count={3} formVisible={false} onToggle={() => {}} />);
    expect(container.querySelector('.tc-count')?.textContent).toBe('3');
  });
  it('кнопка «+ Новый клиент» зовёт onToggle и отражает открытую форму в aria-expanded', () => {
    const onToggle = vi.fn();
    render(<ClientListHero count={1} formVisible onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Новый клиент/ });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
  it('К31: залитой кнопки в шапке нет — «+ Новый клиент» текстом на линии при закрытой и открытой форме; лупы нет', () => {
    const { rerender, container } = render(<ClientListHero count={1} formVisible={false} onToggle={() => {}} />);
    const btn = () => screen.getByRole('button', { name: /Новый клиент/ });
    expect(btn().className).toContain('ds-btn--secondary');
    rerender(<ClientListHero count={1} formVisible onToggle={() => {}} />);
    expect(btn().className).toContain('ds-btn--secondary');
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.querySelector('svg')).toBeNull();
  });
});
