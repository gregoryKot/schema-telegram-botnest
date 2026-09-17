// @vitest-environment jsdom
// Профиль: карточка достижений (CLAUDE.md — приоритет покрытия «профиль/
// статистика», правило «никаких хардкод-заглушек» — на чистом аккаунте
// показывается пустое состояние с призывом к действию, а не выдуманные
// значки).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AchievementsCard } from './AchievementsCard';
import type { Achievement } from '../../apiTypes';

afterEach(() => {
  cleanup();
});

describe('AchievementsCard — пустое состояние (чистый аккаунт)', () => {
  it('нет достижений вообще — счётчик 0 из 0, нет выдуманных значков', () => {
    render(<AchievementsCard achievements={[]} onOpen={() => {}} />);
    expect(screen.getByText('0 из 0')).toBeTruthy();
    expect(
      screen.getByText('Первое — за первую запись в дневник'),
    ).toBeTruthy();
  });

  it('есть достижения, но ни одно не получено — тот же призыв к действию, счётчик 0 из N', () => {
    const achievements: Achievement[] = [
      { id: 'first_day', earned: false },
      { id: 'streak_3', earned: false },
    ];
    render(<AchievementsCard achievements={achievements} onOpen={() => {}} />);
    expect(screen.getByText('0 из 2')).toBeTruthy();
    expect(
      screen.getByText('Первое — за первую запись в дневник'),
    ).toBeTruthy();
  });
});

describe('AchievementsCard — есть полученные достижения', () => {
  it('показывает полученные значки с названием и счётчик N из M', () => {
    const achievements: Achievement[] = [
      { id: 'first_day', earned: true },
      { id: 'streak_3', earned: false },
    ];
    render(<AchievementsCard achievements={achievements} onOpen={() => {}} />);
    expect(screen.getByText('1 из 2')).toBeTruthy();
    expect(screen.getByText('Первый шаг')).toBeTruthy();
    expect(
      screen.queryByText('Первое — за первую запись в дневник'),
    ).toBeNull();
  });

  it('есть неполученные достижения — показывает плашку «ещё N»', () => {
    const achievements: Achievement[] = [
      { id: 'first_day', earned: true },
      { id: 'streak_3', earned: false },
      { id: 'streak_7', earned: false },
    ];
    render(<AchievementsCard achievements={achievements} onOpen={() => {}} />);
    expect(screen.getByText('ещё 2')).toBeTruthy();
  });

  it('все достижения получены — плашка «ещё N» не показывается', () => {
    const achievements: Achievement[] = [
      { id: 'first_day', earned: true },
      { id: 'streak_3', earned: true },
    ];
    render(<AchievementsCard achievements={achievements} onOpen={() => {}} />);
    expect(screen.queryByText(/^ещё/)).toBeNull();
  });

  it('неизвестный id достижения (нет в ACHIEVEMENT_META) — просто пропускается, не падает', () => {
    const achievements: Achievement[] = [
      { id: 'not-a-real-one', earned: true },
    ];
    render(<AchievementsCard achievements={achievements} onOpen={() => {}} />);
    expect(screen.getByText('1 из 1')).toBeTruthy();
  });

  it('клик по карточке вызывает onOpen', () => {
    const onOpen = vi.fn();
    render(<AchievementsCard achievements={[]} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Достижения'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
