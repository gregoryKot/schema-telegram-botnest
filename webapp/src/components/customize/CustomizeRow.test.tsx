// @vitest-environment jsdom
// Строка «Настроить экран» со знаком блока (редизайн 2026-11): колонка знака слева — та же
// .pp-row-art, что у строк «Ещё»; выключенный блок — знак бледный (is-off); без знака — прежняя
// строка. Тап по подписи переключает тумблер (весь ряд — label).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CustomizeRow } from './CustomizeRow';

afterEach(cleanup);

const base = { title: 'Мой путь', sub: 'архив', rowRef: () => {}, offsetY: 0, lifted: false };

describe('CustomizeRow — знак блока', () => {
  it('включён: знак строкой слева, скрыт от чтения, не бледный; тап по подписи переключает', () => {
    const onToggle = vi.fn();
    const { container } = render(<CustomizeRow {...base} sign="sheets" on onToggle={onToggle} />);
    const sign = container.querySelector('.cz-sign')!;
    expect(sign.className).toBe('pp-row-art cz-sign');
    expect(sign.getAttribute('aria-hidden')).toBe('true');
    expect(sign.querySelector('svg.pp-art--row')).toBeTruthy();
    expect(sign.nextElementSibling?.className).toBe('cz-text');
    fireEvent.click(screen.getByText('Мой путь'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('выключен — знак бледный; тумблер aria-checked=false', () => {
    const { container } = render(<CustomizeRow {...base} sign="sheets" on={false} onToggle={() => {}} />);
    expect(container.querySelector('.cz-sign')?.classList.contains('is-off')).toBe(true);
    expect(screen.getByRole('switch', { name: 'Мой путь' }).getAttribute('aria-checked')).toBe('false');
  });

  it('без знака — прежняя строка; без тумблера знак не бледнеет', () => {
    const { container, rerender } = render(<CustomizeRow {...base} on onToggle={() => {}} />);
    expect(container.querySelector('.cz-sign')).toBeNull();
    rerender(<CustomizeRow {...base} sign="heart" />);
    expect(container.querySelector('.cz-sign')?.classList.contains('is-off')).toBe(false);
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
