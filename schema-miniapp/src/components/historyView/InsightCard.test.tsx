// @vitest-environment jsdom
// InsightCard — подсказка «стоит уделить внимание» (самая низкая оценённая
// потребность за неделю). Пустое состояние без выдуманной потребности
// (правило «никаких хардкод-заглушек» — нет оценок совсем, карточка вообще
// не рендерится, а не показывает случайную потребность с 0).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InsightCard } from './InsightCard';
import { Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '💙',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  { id: 'autonomy', emoji: '🔑', title: 'Автономия', chartLabel: 'Автономия' },
];

describe('InsightCard — пустое состояние', () => {
  it('без оценок ничего не рендерит', () => {
    const { container } = render(
      <InsightCard needs={NEEDS} ratings={{}} onTap={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('оценки равны 0 — тоже считаются «не оценено», карточка скрыта', () => {
    const { container } = render(
      <InsightCard
        needs={NEEDS}
        ratings={{ attachment: 0, autonomy: 0 }}
        onTap={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('InsightCard — самая низкая потребность', () => {
  it('показывает потребность с минимальной оценкой среди оценённых', () => {
    render(
      <InsightCard
        needs={NEEDS}
        ratings={{ attachment: 8, autonomy: 3 }}
        onTap={() => {}}
      />,
    );
    expect(screen.getByText('Автономия')).toBeTruthy();
    expect(screen.getByText('оценка 3 из 10')).toBeTruthy();
  });

  it('клик по карточке вызывает onTap с самой низкой потребностью', () => {
    const onTap = vi.fn();
    render(
      <InsightCard
        needs={NEEDS}
        ratings={{ attachment: 8, autonomy: 3 }}
        onTap={onTap}
      />,
    );
    fireEvent.click(screen.getByText('Автономия'));
    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'autonomy' }),
    );
  });

  it('без onTap карточка не тапабельна (нет роли button)', () => {
    render(
      <InsightCard needs={NEEDS} ratings={{ attachment: 5, autonomy: 3 }} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
