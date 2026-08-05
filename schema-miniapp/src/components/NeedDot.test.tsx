// @vitest-environment jsdom
// NeedDot — единственный компонент кружка-опознавателя потребности (волна 5,
// правило «одна механика — один компонент»). Цвет обязан идти из
// shared/src/needs/needColors.ts — тест ловит рассинхрон, если кто-то решит
// снова захардкодить палитру рядом.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NeedDot } from './NeedDot';
import { needColor } from '../../../shared/src/needs/needColors';

afterEach(() => {
  cleanup();
});

describe('NeedDot', () => {
  it('красит кружок цветом потребности из needColors.ts', () => {
    const { container } = render(<NeedDot id="attachment" />);
    const dot = container.firstElementChild as HTMLElement;
    // jsdom нормализует hex → rgb() при чтении из style, поэтому сверяем
    // оба цвета в одинаковом представлении вместо строкового равенства.
    const probe = document.createElement('div');
    probe.style.background = needColor('attachment');
    expect(dot.style.background).toBe(probe.style.background);
  });

  it('размер по умолчанию — 10, задаётся пропом size', () => {
    const { container } = render(<NeedDot id="autonomy" size={16} />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.width).toBe('16px');
    expect(dot.style.height).toBe('16px');
  });

  it('неизвестный id — нейтральный фолбэк, не чужой цвет', () => {
    const { container } = render(<NeedDot id="unknown" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.style.background).toBe(needColor('unknown'));
    expect(dot.style.background).not.toBe(needColor('attachment'));
  });

  it('декоративный — скрыт от скринридера', () => {
    const { container } = render(<NeedDot id="play" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot.getAttribute('aria-hidden')).toBe('true');
  });
});
