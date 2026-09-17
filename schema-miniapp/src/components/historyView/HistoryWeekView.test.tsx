// @vitest-environment jsdom
// HistoryWeekView — недельный вид истории. Проверяет: блок «остаётся
// низкой несколько дней» появляется только когда есть реально низкие
// потребности (needsLow), терапевту не показывается фраза про запись к
// живому человеку (у него уже есть контакт с клиентом), и клик по карточке
// недели зовёт onShowWeekCard.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryWeekView } from './HistoryWeekView';
import type { Need } from '../../types';

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
];

const BASE_PROPS = {
  needs: NEEDS,
  history: [{ date: '2026-08-03', ratings: { attachment: 5 } }],
  selectedIdx: 0,
  selectedRatings: { attachment: 5 },
  days: 7,
  isTherapist: false,
  bookingLink: (label: string) => <button>{label}</button>,
  onTapNeed: () => {},
};

describe('HistoryWeekView — низкая потребность несколько дней', () => {
  it('без needsLow блок с подсказкой не показывается', () => {
    render(
      <HistoryWeekView
        {...BASE_PROPS}
        needsLow={[]}
        onShowWeekCard={() => {}}
      />,
    );
    expect(screen.queryByText(/остаётся низкой/)).toBeNull();
  });

  it('с needsLow (не терапевт) — предлагает записаться к живому человеку', () => {
    render(
      <HistoryWeekView
        {...BASE_PROPS}
        needsLow={[NEEDS[0]]}
        isTherapist={false}
        onShowWeekCard={() => {}}
      />,
    );
    expect(screen.getByText(/остаётся низкой/)).toBeTruthy();
    expect(screen.getByText(/живым человеком рядом/)).toBeTruthy();
    // Текст CTA общий с webapp и с дневным видом (Ж9 аудита 2026-08).
    expect(screen.getByText('Записаться и взять сводку →')).toBeTruthy();
  });

  it('терапевту не показывает фразу про запись (у него уже есть контакт)', () => {
    render(
      <HistoryWeekView
        {...BASE_PROPS}
        needsLow={[NEEDS[0]]}
        isTherapist={true}
        onShowWeekCard={() => {}}
      />,
    );
    expect(screen.getByText(/остаётся низкой/)).toBeTruthy();
    expect(screen.queryByText(/живым человеком рядом/)).toBeNull();
  });
});

describe('HistoryWeekView — карточка недели', () => {
  it('клик по «Карточка недели» вызывает onShowWeekCard', () => {
    const onShowWeekCard = vi.fn();
    render(
      <HistoryWeekView
        {...BASE_PROPS}
        needsLow={[]}
        onShowWeekCard={onShowWeekCard}
      />,
    );
    fireEvent.click(screen.getByText(/Карточка недели/));
    expect(onShowWeekCard).toHaveBeenCalled();
  });

  it('заголовок показывает период в днях', () => {
    render(
      <HistoryWeekView
        {...BASE_PROPS}
        days={14}
        needsLow={[]}
        onShowWeekCard={() => {}}
      />,
    );
    expect(screen.getByText('За 14 дней')).toBeTruthy();
  });
});
