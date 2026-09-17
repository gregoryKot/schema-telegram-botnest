// @vitest-environment jsdom
// AchievementsSheet — полный список достижений в профиле (0% покрытия):
// счётчик N из M из реального массива достижений, прогресс до следующей
// планки серии/дней (не выдуманное число — считается из currentStreak/
// totalDays), неполученные показывают описание вместо прогресса когда он
// нулевой, и клик по полученному значку зовёт onSelect. ShareCardSheet рисует
// canvas — jsdom его не поддерживает, мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AchievementsSheet } from './AchievementsSheet';
import type { Achievement } from '../../apiTypes';

vi.mock('../../share/ShareCardSheet', () => ({
  ShareCardSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="share-card-sheet">
      <button onClick={onClose}>close-share</button>
    </div>
  ),
}));

function makeAchievements(
  overrides: Partial<Record<string, boolean>> = {},
): Achievement[] {
  const ids = ['first_day', 'streak_3', 'streak_7', 'total_10'];
  return ids.map((id) => ({ id, earned: overrides[id] ?? false }));
}

afterEach(cleanup);

describe('AchievementsSheet — счётчик и заголовок', () => {
  it('считает N из M по реальному массиву achievements', () => {
    render(
      <AchievementsSheet
        achievements={makeAchievements({ first_day: true })}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('1 из 4')).toBeTruthy();
  });

  it('пустой массив достижений — 0 из 0, не крашится', () => {
    render(
      <AchievementsSheet
        achievements={[]}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('0 из 0')).toBeTruthy();
  });
});

describe('AchievementsSheet — прогресс к неполученным достижениям', () => {
  it('streak_3 не получено, currentStreak=2 — показывает реальный прогресс «2/3»', () => {
    render(
      <AchievementsSheet
        achievements={makeAchievements()}
        currentStreak={2}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('total_10 не получено, totalDays=4 — показывает «4/10»', () => {
    render(
      <AchievementsSheet
        achievements={makeAchievements()}
        currentStreak={0}
        totalDays={4}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('4/10')).toBeTruthy();
  });

  it('currentStreak=0 (нет серии) — прогресс не показан, вместо него описание достижения', () => {
    render(
      <AchievementsSheet
        achievements={makeAchievements()}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText('0/3')).toBeNull();
    expect(screen.getByText('3 дня подряд')).toBeTruthy();
  });

  it('неизвестный id достижения (нет в ACHIEVEMENT_META) — пропускается без падения', () => {
    render(
      <AchievementsSheet
        achievements={[{ id: 'ghost_achievement', earned: true }]}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('1 из 1')).toBeTruthy();
  });
});

describe('AchievementsSheet — взаимодействие', () => {
  it('клик по полученному значку зовёт onSelect с его id', () => {
    const onSelect = vi.fn();
    render(
      <AchievementsSheet
        achievements={makeAchievements({ first_day: true })}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Первый шаг'));
    expect(onSelect).toHaveBeenCalledWith('first_day');
  });

  it('клик по неполученному значку не зовёт onSelect', () => {
    const onSelect = vi.fn();
    render(
      <AchievementsSheet
        achievements={makeAchievements()}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Начало серии'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('нет полученных достижений — кнопка «Поделиться» не рендерится', () => {
    render(
      <AchievementsSheet
        achievements={makeAchievements()}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByLabelText('Поделиться')).toBeNull();
  });

  it('есть полученные достижения — «Поделиться» открывает ShareCardSheet, close закрывает', () => {
    render(
      <AchievementsSheet
        achievements={makeAchievements({ first_day: true })}
        currentStreak={0}
        totalDays={0}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByTestId('share-card-sheet')).toBeTruthy();
    fireEvent.click(screen.getByText('close-share'));
    expect(screen.queryByTestId('share-card-sheet')).toBeNull();
  });
});
