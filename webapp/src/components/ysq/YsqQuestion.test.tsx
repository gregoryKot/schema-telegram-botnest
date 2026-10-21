// @vitest-environment jsdom
// YsqQuestion — фаза вопроса теста схем. Аудит 2026-10, «Доступность»:
// полоса прогресса была progressbar без имени, его поймало включённое
// jsx-a11y/control-has-associated-label.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { YsqQuestion } from './YsqQuestion';
import { TOTAL_PAGES } from '../../hooks/useYsqTest';

afterEach(() => {
  cleanup();
});

function renderQuestion(page: number) {
  return render(
    <YsqQuestion page={page} slideKey={0} slideDir="forward" answer={0} schema={null}
      onSelect={vi.fn()} onBack={vi.fn()} onClose={vi.fn()} />,
  );
}

describe('YsqQuestion — имена контролов', () => {
  it('полоса прогресса названа «Вопрос теста» и стоит на текущем вопросе', () => {
    renderQuestion(2);
    const bar = screen.getByRole('progressbar', { name: 'Вопрос теста' });
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe(String(TOTAL_PAGES));
  });

  it('крестик назван «Закрыть»', () => {
    renderQuestion(0);
    expect(screen.getByRole('button', { name: 'Закрыть' }).textContent).toBe('✕');
  });
});
