// @vitest-environment jsdom
// ModeStep — первый шаг флэшкарты: выбор активного режима. Проверяет клик
// по режиму (onSelectMode) и условную кнопку «История» (видна только когда
// уже есть сохранённые карточки — allCardsCount > 0).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeStep } from './ModeStep';
import type { ModeData } from './types';

afterEach(() => {
  cleanup();
});

const MODES: ModeData[] = [
  {
    id: 'vulnerable_child',
    emoji: '😢',
    label: 'Уязвимый Ребёнок',
    desc: 'Грустно',
    response: '...',
    color: '#60a5fa',
  },
  {
    id: 'angry_child',
    emoji: '😡',
    label: 'Злой Ребёнок',
    desc: 'Злость',
    response: '...',
    color: '#f87171',
  },
];

describe('ModeStep', () => {
  it('клик по режиму вызывает onSelectMode с id режима', () => {
    const onSelectMode = vi.fn();
    render(
      <ModeStep
        modes={MODES}
        allCardsCount={0}
        stepIndex={0}
        onClose={() => {}}
        onShowHistory={() => {}}
        onSelectMode={onSelectMode}
      />,
    );
    fireEvent.click(screen.getByText('Злой Ребёнок'));
    expect(onSelectMode).toHaveBeenCalledWith('angry_child');
  });

  it('без сохранённых карточек кнопка «История» не отображается', () => {
    render(
      <ModeStep
        modes={MODES}
        allCardsCount={0}
        stepIndex={0}
        onClose={() => {}}
        onShowHistory={() => {}}
        onSelectMode={() => {}}
      />,
    );
    expect(screen.queryByText('История')).toBeNull();
  });

  it('с сохранёнными карточками кнопка «История» вызывает onShowHistory', () => {
    const onShowHistory = vi.fn();
    render(
      <ModeStep
        modes={MODES}
        allCardsCount={3}
        stepIndex={0}
        onClose={() => {}}
        onShowHistory={onShowHistory}
        onSelectMode={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('История'));
    expect(onShowHistory).toHaveBeenCalled();
  });
});
