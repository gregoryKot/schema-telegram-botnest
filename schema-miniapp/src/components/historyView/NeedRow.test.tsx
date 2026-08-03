// @vitest-environment jsdom
// NeedRow — строка потребности в истории. Проверяет пороги словесной
// метки (низко/средне/хорошо/—) — регресс границ (3 vs 4, 6 vs 7) незаметен
// глазом, только тестом, — и что onTap опционален (без него нет роли button).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedRow } from './NeedRow';
import { Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEED: Need = {
  id: 'autonomy',
  emoji: '🔑',
  title: 'Автономия',
  chartLabel: 'Автономия',
};

describe('NeedRow — словесная метка по значению', () => {
  it('0 — метка "—"', () => {
    render(<NeedRow need={NEED} value={0} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('3 — "низко" (граница включительно)', () => {
    render(<NeedRow need={NEED} value={3} />);
    expect(screen.getByText('низко')).toBeTruthy();
  });

  it('4 — "средне" (следующая граница)', () => {
    render(<NeedRow need={NEED} value={4} />);
    expect(screen.getByText('средне')).toBeTruthy();
  });

  it('6 — "средне" (верхняя граница включительно)', () => {
    render(<NeedRow need={NEED} value={6} />);
    expect(screen.getByText('средне')).toBeTruthy();
  });

  it('7 — "хорошо"', () => {
    render(<NeedRow need={NEED} value={7} />);
    expect(screen.getByText('хорошо')).toBeTruthy();
  });
});

describe('NeedRow — интерактивность', () => {
  it('с onTap — роль button, клик и Enter вызывают onTap', () => {
    const onTap = vi.fn();
    render(<NeedRow need={NEED} value={5} onTap={onTap} />);
    const row = screen.getByRole('button');
    fireEvent.click(row);
    expect(onTap).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onTap).toHaveBeenCalledTimes(2);
  });

  it('без onTap — нет роли button', () => {
    render(<NeedRow need={NEED} value={5} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
