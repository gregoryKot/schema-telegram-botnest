// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Disclosure, type DisclosureClasses } from './Disclosure';

const CLASSES: DisclosureClasses = {
  root: 'f-root',
  btn: 'f-btn',
  label: 'f-label',
  chev: 'f-chev',
  body: 'f-body',
};

afterEach(() => cleanup());

describe('Disclosure', () => {
  it('по умолчанию закрыта: содержимого нет, aria-expanded=false, клик открывает и закрывает', () => {
    render(
      <Disclosure title="Как читать">
        <p>Текст</p>
      </Disclosure>,
    );
    const btn = screen.getByRole('button', { name: /Как читать/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Текст')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Текст')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByText('Текст')).toBeNull();
  });

  it('defaultOpen — открыта сразу, но закрывается кликом', () => {
    render(
      <Disclosure title="Как читать" defaultOpen>
        <p>Текст</p>
      </Disclosure>,
    );
    expect(screen.getByText('Текст')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Как читать/ }));
    expect(screen.queryByText('Текст')).toBeNull();
  });

  it('с classes: разметка ds-fold, шеврон пустой и скрыт, тело монтируется только открытым', () => {
    const { container } = render(
      <Disclosure title="Как читать" classes={CLASSES}>
        <p>Текст</p>
      </Disclosure>,
    );
    expect(container.firstElementChild?.className).toBe('f-root');
    const btn = screen.getByRole('button', { name: 'Как читать' });
    expect(btn.className).toBe('f-btn');
    expect(btn.getAttribute('style')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const chev = btn.querySelector('.f-chev');
    expect(chev?.textContent).toBe('');
    expect(chev?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.f-body')).toBeNull();
    expect(screen.queryByText('Текст')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.f-body')?.textContent).toBe('Текст');
  });
});
