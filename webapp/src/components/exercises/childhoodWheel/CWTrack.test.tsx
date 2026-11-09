// @vitest-environment jsdom
// Полоса ползунка «Колеса детства» на сайте: вертикальный жест с неё —
// прокрутка страницы, а не оценка (бэклог 2026-10). Разбор жеста —
// shared/src/childhoodWheel/sliderGesture.ts; здесь — что трек отдаёт
// вертикаль браузеру и что палец без тапа оценку не ставит.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CWTrack } from './CWTrack';

afterEach(() => cleanup());

describe('CWTrack', () => {
  it('трек отдаёт вертикальный жест прокрутке (touch-action: pan-y)', () => {
    const css = readFileSync(join(__dirname, '../../../styles/ex-wheel.css'), 'utf8');
    const rule = css.match(/\.ex2-cw-track\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/touch-action:\s*pan-y/);
  });

  it('прокрутка пальцем с полосы не ставит оценку, тап — ставит', () => {
    const onChange = vi.fn();
    render(<CWTrack value={undefined} onChange={onChange} hue={28} label="Безопасность" />);
    const el = screen.getByRole('slider', { name: 'Безопасность' });
    el.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 44, right: 100, bottom: 44, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(el, { clientX: 50, clientY: 10, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(el, { clientX: 52, clientY: 60, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 52, clientY: 60 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(el, { clientX: 30, clientY: 10, pointerId: 2, pointerType: 'touch' });
    fireEvent.pointerUp(el, { clientX: 30, clientY: 10 });
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
