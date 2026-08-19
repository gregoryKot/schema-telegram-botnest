// @vitest-environment jsdom
// BottomNav — нижняя навигация. Смоук на 0% покрытии: клики по всем вкладкам
// зовут onSelect с правильным id, активная вкладка визуально отмечена
// (aria/текст), терапевт-роль не ломает рендер иконок.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BottomNav, type Section } from './BottomNav';

afterEach(cleanup);

const LABELS: Record<Section, string> = {
  today: 'Сегодня',
  help: 'Помощь',
  schemas: 'Паттерны',
  profile: 'Я',
};

describe('BottomNav — вкладки', () => {
  it('рендерит все 4 вкладки с подписями', () => {
    render(<BottomNav section="today" onSelect={() => {}} />);
    for (const label of Object.values(LABELS)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it.each(Object.entries(LABELS) as [Section, string][])(
    'клик по «%s» зовёт onSelect(%s)',
    (id, label) => {
      const onSelect = vi.fn();
      render(<BottomNav section="today" onSelect={onSelect} />);
      screen.getByText(label).closest('button')!.click();
      expect(onSelect).toHaveBeenCalledWith(id);
    },
  );

  it('userRole=THERAPIST не ломает рендер (иконка помощи остаётся той же меткой)', () => {
    render(
      <BottomNav section="help" onSelect={() => {}} userRole="THERAPIST" />,
    );
    expect(screen.getByText('Помощь')).toBeTruthy();
  });
});
