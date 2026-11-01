// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Disclosure } from './Disclosure';

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
});
