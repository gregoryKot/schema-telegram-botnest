// @vitest-environment jsdom
// Профиль: карточка серии дней (CLAUDE.md — приоритет покрытия «профиль/
// статистика», правило «никаких хардкод-заглушек» — пустое состояние
// обязано показывать «—»/нейтральный текст, а не выдуманные цифры).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StreakCard } from './StreakCard';

afterEach(() => {
  cleanup();
});

describe('StreakCard — пустое состояние (чистый аккаунт)', () => {
  it('нет данных вообще — показывает «—», «пока не начато», без рекорда и CTA', () => {
    render(
      <StreakCard
        currentStreak={0}
        longestStreak={0}
        totalDays={0}
        todayDone={false}
        weekDots={[]}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('пока', { exact: false })).toBeTruthy();
    expect(screen.queryByText('рекорд')).toBeNull();
    expect(screen.queryByText('Заполнить сегодня →')).toBeNull();
    // totalDays=0 отображается как реальный ноль, а не скрывается/подменяется.
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('StreakCard — активная серия', () => {
  it('серия из одного дня — единственное число «день подряд»', () => {
    render(
      <StreakCard
        currentStreak={1}
        longestStreak={1}
        totalDays={1}
        todayDone={true}
        weekDots={[true, false, false, false, false, false, false]}
      />,
    );
    expect(screen.getAllByText('1', { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByText(/день/)).toBeTruthy();
  });

  it('серия из 3 дней — «дня подряд» (2-4)', () => {
    render(
      <StreakCard
        currentStreak={3}
        longestStreak={3}
        totalDays={3}
        todayDone={true}
        weekDots={[true, true, true, false, false, false, false]}
      />,
    );
    expect(screen.getByText(/дня/)).toBeTruthy();
  });

  it('серия из 7 дней — «дней подряд» (5+) и рекорд отображается', () => {
    render(
      <StreakCard
        currentStreak={7}
        longestStreak={10}
        totalDays={20}
        todayDone={true}
        weekDots={[true, true, true, true, true, true, true]}
      />,
    );
    expect(screen.getByText(/дней/)).toBeTruthy();
    expect(screen.getByText('рекорд')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('серия прервалась (currentStreak=0, totalDays>0) — CTA «Заполнить сегодня» и клик вызывает onOpenTracker', () => {
    const onOpenTracker = vi.fn();
    render(
      <StreakCard
        currentStreak={0}
        longestStreak={5}
        totalDays={12}
        todayDone={false}
        weekDots={[false, false, false, false, false, false, false]}
        onOpenTracker={onOpenTracker}
      />,
    );
    expect(screen.getByText('серия', { exact: false })).toBeTruthy();
    const cta = screen.getByText('Заполнить сегодня →');
    fireEvent.click(cta);
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('без onOpenTracker — CTA не рендерится, даже если серия прервалась', () => {
    render(
      <StreakCard
        currentStreak={0}
        longestStreak={5}
        totalDays={12}
        todayDone={false}
        weekDots={[false, false, false, false, false, false, false]}
      />,
    );
    expect(screen.queryByText('Заполнить сегодня →')).toBeNull();
  });
});
