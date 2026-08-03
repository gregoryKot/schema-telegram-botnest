// @vitest-environment jsdom
// Профиль: карточка паттернов (CLAUDE.md — приоритет покрытия «профиль/
// статистика», правило «никаких хардкод-заглушек» — на чистом аккаунте не
// должно быть выдуманных «лучший день»/цифр, только то, что реально пришло).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InsightsCard } from './InsightsCard';
import type { InsightsData } from './types';

afterEach(() => {
  cleanup();
});

function insights(overrides: Partial<InsightsData> = {}): InsightsData {
  return {
    weeklyStats: [],
    bestDayOfWeek: null,
    worstDayOfWeek: null,
    totalDays: 0,
    ...overrides,
  };
}

describe('InsightsCard — пустое состояние (чистый аккаунт)', () => {
  it('нет данных вообще — не показывает лучший/худший день и полосы потребностей', () => {
    const { container } = render(
      <InsightsCard insights={insights()} onShowBestDayInfo={() => {}} />,
    );
    expect(screen.queryByText('лучший день')).toBeNull();
    expect(screen.queryByText('тяжелее')).toBeNull();
    // Заголовок остаётся (форма карточки на месте), полос данных — ноль.
    expect(screen.getByText('Паттерны')).toBeTruthy();
    expect(container.querySelectorAll('span').length).toBeLessThan(5);
  });

  it('меньше 7 дней данных — даже если есть лучший день, пилюли не показываются (мало данных для вывода)', () => {
    render(
      <InsightsCard
        insights={insights({ bestDayOfWeek: 'вторник', totalDays: 3 })}
        onShowBestDayInfo={() => {}}
      />,
    );
    expect(screen.queryByText('лучший день')).toBeNull();
  });
});

describe('InsightsCard — есть накопленные данные', () => {
  it('7+ дней и есть лучший/худший день — показывает обе пилюли', () => {
    render(
      <InsightsCard
        insights={insights({
          bestDayOfWeek: 'вторник',
          worstDayOfWeek: 'пятница',
          totalDays: 10,
        })}
        onShowBestDayInfo={() => {}}
      />,
    );
    expect(screen.getByText('вторник')).toBeTruthy();
    expect(screen.getByText('пятница')).toBeTruthy();
  });

  it('клик по «?» у лучшего дня вызывает onShowBestDayInfo, не всплывает дальше', () => {
    const onShowBestDayInfo = vi.fn();
    render(
      <InsightsCard
        insights={insights({ bestDayOfWeek: 'вторник', totalDays: 10 })}
        onShowBestDayInfo={onShowBestDayInfo}
      />,
    );
    fireEvent.click(screen.getByLabelText('Что такое лучший день'));
    expect(onShowBestDayInfo).toHaveBeenCalledTimes(1);
  });

  it('показывает только потребности с реальным средним значением (avg !== null)', () => {
    render(
      <InsightsCard
        insights={insights({
          weeklyStats: [
            { needId: 'attachment', avg: 7.4, trend: '↑' },
            { needId: 'autonomy', avg: null, trend: '→' },
          ],
        })}
        onShowBestDayInfo={() => {}}
      />,
    );
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('7.4', { exact: false })).toBeTruthy();
    expect(screen.queryByText('Автономия')).toBeNull();
  });
});
