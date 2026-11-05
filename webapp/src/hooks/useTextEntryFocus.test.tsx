// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useTextEntryFocus } from './useTextEntryFocus';
import { isTextEntry } from './textEntryFocus.store';

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

  // Инцидент 2026-11-05: панель возвращалась на focusout, пока окно ещё
  // укорочено на клавиатуру, и застревала посреди экрана.
  it('телефон: уход фокуса при открытой клавиатуре — печатает, пока окно не вернулось', () => {
    setTouch(true);
    const vv = Object.assign(new EventTarget(), { height: 500 });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    try {
      render(<Probe />);
      focus(screen.getByLabelText('area'));
      blur(screen.getByLabelText('area'));
      expect(screen.getByTestId('state').textContent).toBe('typing');
      vv.height = 800;
      act(() => { vv.dispatchEvent(new Event('resize')); });
      expect(screen.getByTestId('state').textContent).toBe('idle');
      // Снова в поле и обратно, пока клавиатура ещё не ушла: старое ожидание не стреляет.
      focus(screen.getByLabelText('area'));
      vv.height = 500;
      blur(screen.getByLabelText('area'));
      focus(screen.getByLabelText('area'));
      vv.height = 800;
      act(() => { vv.dispatchEvent(new Event('resize')); });
      expect(screen.getByTestId('state').textContent).toBe('typing');
    } finally {
      Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    }
  });

  it('мышь (десктоп): фокус в поле ничего не прячет', () => {
    setTouch(false);
    render(<Probe />);
    focus(screen.getByLabelText('area'));
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });
});
