// @vitest-environment jsdom
// Профиль: пояснение «Лучший день» (CLAUDE.md — приоритет покрытия
// «профиль/статистика»). Поведение: показывает объяснение, крестик закрывает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BestDayInfoSheet } from './BestDayInfoSheet';

afterEach(() => {
  cleanup();
});

describe('BestDayInfoSheet', () => {
  it('показывает объяснение термина «Лучший день»', () => {
    render(<BestDayInfoSheet onClose={() => {}} />);
    expect(screen.getByText('Лучший день')).toBeTruthy();
    expect(
      screen.getByText(
        'День недели, в который твои оценки в среднем выше всего.',
      ),
    ).toBeTruthy();
  });

  it('клик по фону закрывает шит', () => {
    const onClose = vi.fn();
    render(<BestDayInfoSheet onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
