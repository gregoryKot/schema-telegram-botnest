// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { isTextEntry, useTextEntryFocus } from './useTextEntryFocus';

function setTouch(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: coarse && q.includes('pointer: coarse'),
    media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function Probe() {
  const typing = useTextEntryFocus();
  return (
    <div>
      <span data-testid="state">{typing ? 'typing' : 'idle'}</span>
      <textarea aria-label="area" />
      <input aria-label="second" type="text" />
      <input aria-label="check" type="checkbox" />
      <button>btn</button>
    </div>
  );
}

const focus = (el: HTMLElement) => act(() => { el.focus(); });
const blur = (el: HTMLElement) => act(() => { el.blur(); });

afterEach(() => { vi.restoreAllMocks(); });

describe('isTextEntry', () => {
  it('поля, открывающие клавиатуру, — да', () => {
    expect(isTextEntry(document.createElement('textarea'))).toBe(true);
    const text = document.createElement('input');
    expect(isTextEntry(text)).toBe(true);
    text.type = 'email';
    expect(isTextEntry(text)).toBe(true);
  });

  it('чекбокс, кнопка, select, readonly, disabled и пусто — нет', () => {
    for (const type of ['checkbox', 'radio', 'range', 'button', 'submit']) {
      const i = document.createElement('input');
      i.type = type;
      expect(isTextEntry(i)).toBe(false);
    }
    expect(isTextEntry(document.createElement('select'))).toBe(false);
    expect(isTextEntry(document.createElement('button'))).toBe(false);
    const ro = document.createElement('textarea');
    ro.readOnly = true;
    expect(isTextEntry(ro)).toBe(false);
    const dis = document.createElement('input');
    dis.disabled = true;
    expect(isTextEntry(dis)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe('useTextEntryFocus', () => {
  it('телефон: фокус в поле — печатает, уход фокуса — нет', () => {
    setTouch(true);
    render(<Probe />);
    expect(screen.getByTestId('state').textContent).toBe('idle');
    focus(screen.getByLabelText('area'));
    expect(screen.getByTestId('state').textContent).toBe('typing');
    blur(screen.getByLabelText('area'));
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });

  it('из поля в поле клавиатура не закрывается', () => {
    setTouch(true);
    render(<Probe />);
    focus(screen.getByLabelText('area'));
    focus(screen.getByLabelText('second'));
    expect(screen.getByTestId('state').textContent).toBe('typing');
  });

  it('из поля на кнопку или чекбокс — клавиатура закрылась', () => {
    setTouch(true);
    render(<Probe />);
    focus(screen.getByLabelText('area'));
    focus(screen.getByText('btn'));
    expect(screen.getByTestId('state').textContent).toBe('idle');
    focus(screen.getByLabelText('area'));
    focus(screen.getByLabelText('check'));
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });

  it('мышь (десктоп): фокус в поле ничего не прячет', () => {
    setTouch(false);
    render(<Probe />);
    focus(screen.getByLabelText('area'));
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });
});
