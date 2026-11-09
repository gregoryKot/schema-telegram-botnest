// @vitest-environment jsdom
// useQuietFocus — «тихое» кольцо фокуса у окна, открытого не с клавиатуры. Режим ввода — последнее
// событие на странице (клавиша без модификатора или касание); «тихое» окно оживает от первой клавиши
// перехода (Tab, стрелки, Home/End), а от прочих клавиш — нет.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useQuietFocus } from './useQuietFocus';

afterEach(cleanup);

function Box() {
  const props = useQuietFocus();
  return <div data-testid="box" tabIndex={-1} {...props} />;
}
const box = (c: HTMLElement) => c.querySelector('[data-testid="box"]') as HTMLElement;

describe('useQuietFocus', () => {
  it('открыто касанием — окно «тихое»', () => {
    fireEvent.pointerDown(document.body);
    const { container } = render(<Box />);
    expect(box(container).getAttribute('data-focus')).toBe('quiet');
  });

  it('открыто с клавиатуры — кольцо сразу', () => {
    fireEvent.keyDown(document.body, { key: 'Enter' });
    const { container } = render(<Box />);
    expect(box(container).hasAttribute('data-focus')).toBe(false);
  });

  it('сочетание с ⌘/Ctrl/Alt не считается вводом с клавиатуры', () => {
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    const { container } = render(<Box />);
    expect(box(container).getAttribute('data-focus')).toBe('quiet');
  });

  it('клавиша перехода внутри «тихого» окна возвращает кольцо, прочие — нет', () => {
    fireEvent.pointerDown(document.body);
    const { container } = render(<Box />);
    fireEvent.keyDown(box(container), { key: 'a' });
    expect(box(container).getAttribute('data-focus')).toBe('quiet');
    fireEvent.keyDown(box(container), { key: 'Tab' });
    expect(box(container).hasAttribute('data-focus')).toBe(false);
  });

  it.each(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])('%s — тоже клавиша перехода', (key) => {
    fireEvent.pointerDown(document.body);
    const { container } = render(<Box />);
    fireEvent.keyDown(box(container), { key });
    expect(box(container).hasAttribute('data-focus')).toBe(false);
  });
});
