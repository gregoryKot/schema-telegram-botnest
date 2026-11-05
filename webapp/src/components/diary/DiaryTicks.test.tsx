// @vitest-environment jsdom
// Полоски-шаги мастеров дневника прыгают на шаг, но были 24px по высоте при
// видимой полоске 5px — пальцем не попасть (аудит онбординга 2026-10-08).
// Зона теперь 44 по высоте, отрицательный margin держит прежнюю раскладку.
// CSS в jsdom не считается — правило sheet-diary.css пинится строкой исходника.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DiaryTicks } from './DiaryStepCard';

const css = readFileSync(join(__dirname, '../../styles/sheet-diary.css'), 'utf8');
const tickRule = css.match(/(^|\n)\.sd-tick \{([^}]*)\}/)?.[2] ?? '';

describe('DiaryTicks — шаги мастера', () => {
  it('каждая полоска названа и прыгает на свой шаг', () => {
    const onJump = vi.fn();
    render(<DiaryTicks filled={[true, false, false]} active={1} hue={200} onJump={onJump} />);
    fireEvent.click(screen.getByRole('button', { name: 'Шаг 3' }));
    expect(onJump).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Шаг 2' }).getAttribute('aria-current')).toBe('step');
  });

  it('зона нажатия полоски — не меньше 44px по высоте', () => {
    const h = Number(tickRule.match(/min-height:\s*(\d+)px/)?.[1] ?? 0);
    expect(h).toBeGreaterThanOrEqual(44);
  });

  it('раскладка не выросла: отрицательный margin компенсирует зону до прежних 24px', () => {
    const h = Number(tickRule.match(/min-height:\s*(\d+)px/)?.[1] ?? 0);
    const m = Number(tickRule.match(/margin-block:\s*-(\d+)px/)?.[1] ?? 0);
    expect(h - 2 * m).toBe(24);
  });
});
