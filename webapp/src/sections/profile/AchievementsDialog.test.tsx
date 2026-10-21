// @vitest-environment jsdom
// Диалог достижений: шаринг ВСЕХ достижений (этап 3 единой версии) — кнопка
// видна, только когда есть полученные; открывает карточку с типом
// 'achievements' и счётом «получено из всех».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AchievementsDialog } from './AchievementsDialog';

const shareProps = vi.fn();
vi.mock('../../share/ShareCardSheet', () => ({
  ShareCardSheet: (p: Record<string, unknown> & { onClose: () => void }) => {
    shareProps(p);
    return <div data-testid="share-sheet"><button onClick={p.onClose}>закрыть шаринг</button></div>;
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const list = (earned: boolean[]) => earned.map((e, i) => ({ id: ['first_day', 'streak_3', 'streak_7'][i], earned: e })) as never;

function renderDialog(earned: boolean[], onSelect = vi.fn()) {
  render(<MemoryRouter><AchievementsDialog achievements={list(earned)} currentStreak={1} totalDays={1} onSelect={onSelect} onClose={vi.fn()} /></MemoryRouter>);
  return { onSelect };
}

describe('AchievementsDialog — шаринг', () => {
  it('нет полученных — делиться нечем, кнопки нет', () => {
    renderDialog([false, false, false]);
    expect(screen.queryByLabelText('Поделиться достижениями')).toBeNull();
  });

  it('есть полученные — кнопка открывает лист шаринга с нужными параметрами', () => {
    renderDialog([true, false, true]);
    expect(screen.getByText('2 из 3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Поделиться достижениями'));
    expect(screen.getByTestId('share-sheet')).toBeTruthy();
    const p = shareProps.mock.calls[0][0];
    expect(p.eventKind).toBe('achievements');
    expect(p.filename).toBe('achievements.png');
    expect(p.shareText).toContain('2');
    expect(typeof p.draw).toBe('function');
    fireEvent.click(screen.getByText('закрыть шаринг'));
    expect(screen.queryByTestId('share-sheet')).toBeNull();
  });

  it('плитка полученного открывает деталь, неполученного — нет', () => {
    const { onSelect } = renderDialog([true, false, false]);
    fireEvent.click(screen.getByText('Первый шаг'));
    expect(onSelect).toHaveBeenCalledWith('first_day');
    fireEvent.click(screen.getByText('Начало серии'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
