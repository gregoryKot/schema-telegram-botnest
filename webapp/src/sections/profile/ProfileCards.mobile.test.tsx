// @vitest-environment jsdom
// Профиль: шапка одного состава на любой ширине (#906), плитка «ещё N» у достижений,
// таблетки и полосы паттернов. Видимость на ≤767px решает css, здесь — разметка и данные.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfileHeader } from './ProfileHeader';
import { AchievementsCard } from './AchievementsCard';
import { PatternsCard } from './PatternsCard';

const phone = vi.hoisted(() => ({ value: true }));
vi.mock('../../components/useIsMobile', () => ({ useIsMobile: () => phone.value }));

afterEach(() => { cleanup(); phone.value = true; });

describe('ProfileHeader', () => {
  // Один состав на любой ширине (#906): надпись, «Мой путь», подпись с именем и днями,
  // ссылка «Настроить экран» и шестерёнка «Настройки» — телефон ничего не выбрасывает.
  it.each([true, false])('телефон=%s: надпись и ds-h1 «Мой путь», имя и дни — в подписи', (mobile) => {
    phone.value = mobile;
    const { container } = render(<ProfileHeader displayName="Аня" totalDays={21} onCustomize={() => {}} />);
    expect(screen.getByText('Профиль', { selector: '.ds-eyebrow' })).toBeTruthy();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Мой путь');
    expect(h1.className).toContain('ds-h1');
    expect(container.querySelector('.cpf-head-sub')?.textContent).toBe('Аня · 21 день с тобой в приложении');
  });

  it.each([true, false])('телефон=%s: «Настроить экран» зовёт onCustomize, шестерёнка — onOpenSettings; без обработчика шестерёнки нет', (mobile) => {
    phone.value = mobile;
    const onCustomize = vi.fn();
    const onOpen = vi.fn();
    const { rerender } = render(<ProfileHeader displayName="Аня" totalDays={23} onCustomize={onCustomize} onOpenSettings={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    expect(onCustomize).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<ProfileHeader displayName="Аня" totalDays={23} onCustomize={onCustomize} />);
    expect(screen.queryByRole('button', { name: 'Настройки' })).toBeNull();
  });

  it('дни склоняются; без имени — только дни, без дней — только имя, без того и другого подписи нет', () => {
    const { container, rerender } = render(<ProfileHeader displayName={null} totalDays={2} onCustomize={() => {}} />);
    expect(container.querySelector('.cpf-head-sub')?.textContent).toBe('2 дня с тобой в приложении');
    rerender(<ProfileHeader displayName="Аня" totalDays={0} onCustomize={() => {}} />);
    expect(container.querySelector('.cpf-head-sub')?.textContent).toBe('Аня');
    rerender(<ProfileHeader displayName={null} totalDays={0} onCustomize={() => {}} />);
    expect(container.querySelector('.cpf-head-sub')).toBeNull();
  });
});

describe('AchievementsCard', () => {
  const ach = [
    { id: 'streak_3', earned: true }, { id: 'streak_7', earned: false }, { id: 'streak_14', earned: false },
  ] as never[];
  it('неполученные сворачиваются в «ещё N»', () => {
    render(<AchievementsCard achievements={ach} onOpen={() => {}} />);
    expect(screen.getByText('ещё 2')).toBeTruthy();
  });
  it('все получены — плитки «ещё» нет', () => {
    render(<AchievementsCard achievements={[{ id: 'streak_3', earned: true }] as never[]} onOpen={() => {}} />);
    expect(screen.queryByText(/^ещё/)).toBeNull();
  });
});

describe('PatternsCard', () => {
  const insights = {
    weeklyStats: [
      { needId: 'attachment', avg: 4, trend: '↑' as const },
      { needId: 'autonomy', avg: null, trend: '→' as const },
      { needId: 'limits', avg: 6.8, trend: '↓' as const },
    ],
    bestDayOfWeek: 'суббота', worstDayOfWeek: 'понедельник', totalDays: 10,
  };
  it('строки с данными: значение, стрелка и полоса по среднему; без данных — нет строки', () => {
    const { container } = render(<PatternsCard insights={insights} onBestDayInfo={() => {}} />);
    expect(screen.getByText('4.0')).toBeTruthy();
    expect(screen.queryByText('Автономия')).toBeNull();
    const widths = [...container.querySelectorAll<HTMLElement>('.cpf-prog-fill')].map(e => e.style.width);
    expect(widths).toEqual(['40%', '68%']);
    expect(container.querySelector('.cpf-prog-fill.is-down')).not.toBeNull();
  });
  it('таблетки дней — только при ≥7 днях данных', () => {
    const { rerender } = render(<PatternsCard insights={insights} onBestDayInfo={() => {}} />);
    expect(screen.getByText('суббота')).toBeTruthy();
    expect(screen.getByText('понедельник')).toBeTruthy();
    rerender(<PatternsCard insights={{ ...insights, totalDays: 3 }} onBestDayInfo={() => {}} />);
    expect(screen.queryByText('суббота')).toBeNull();
  });
  it('«?» у лучшего дня зовёт onBestDayInfo', () => {
    const onInfo = vi.fn();
    render(<PatternsCard insights={insights} onBestDayInfo={onInfo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Что такое лучший день' }));
    expect(onInfo).toHaveBeenCalled();
  });
});
