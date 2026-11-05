// @vitest-environment jsdom
// «Отменить подписку» на /subscribe?token=… была подчёркнутой строкой высотой
// 21px: на телефоне тап-цель меньше 44 (на ≥768 высоту поднимало отдельное
// правило auth-pay.css). Теперь minHeight живёт в самой кнопке — одна механика
// на обе раскладки.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CancelControl } from './CancelControl';

describe('CancelControl — тап-цель', () => {
  it('кнопка «Отменить подписку» не ниже 44px на любой ширине', () => {
    render(<CancelControl token="t" onCancelled={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Отменить подписку' });
    expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('высоту не держит второе правило только для компьютера', () => {
    const css = readFileSync(join(__dirname, '../../styles/auth-pay.css'), 'utf8');
    expect(css).not.toMatch(/\.ap-main--state > button/);
  });
});
