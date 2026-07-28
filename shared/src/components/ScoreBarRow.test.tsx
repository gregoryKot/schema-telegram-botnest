// @vitest-environment jsdom
// Ряд метрики результата теста на схемы — общий контрол (правило №3).
// Поведение, не разметка: подпись/значение видны, бар отражает barPct.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScoreBarRow } from './ScoreBarRow';

afterEach(() => {
  cleanup();
});

describe('ScoreBarRow', () => {
  it('показывает подпись и отформатированное значение', () => {
    render(
      <ScoreBarRow
        label="Отвержение"
        barPct={40}
        value="4.2"
        color="#fff"
        mb={8}
      />,
    );
    expect(screen.getByText('Отвержение')).toBeTruthy();
    expect(screen.getByText('4.2')).toBeTruthy();
  });

  it('ширина бара соответствует barPct', () => {
    const { container } = render(
      <ScoreBarRow label="L" barPct={73} value="v" color="#000" mb={0} />,
    );
    // document order: [root, track, fill] — только у fill выставлен width
    const fill = container.querySelectorAll('div')[2];
    expect(fill.style.width).toBe('73%');
  });

  it('barPct=0 → пустой бар', () => {
    const { container } = render(
      <ScoreBarRow label="L" barPct={0} value="v" color="#000" mb={0} />,
    );
    const fill = container.querySelectorAll('div')[2];
    expect(fill.style.width).toBe('0%');
  });
});
