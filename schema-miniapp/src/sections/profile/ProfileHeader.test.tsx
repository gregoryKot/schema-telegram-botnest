// @vitest-environment jsdom
// Профиль: шапка (CLAUDE.md — приоритет покрытия «профиль/статистика»,
// правило «никаких хардкод-заглушек» — на чистом аккаунте (totalDays=0)
// строка «N дней в приложении» не показывается вовсе, а не «0 дней»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProfileHeader } from './ProfileHeader';

afterEach(() => {
  cleanup();
});

describe('ProfileHeader', () => {
  it('чистый аккаунт (totalDays=0) — строка «дней в приложении» не показывается', () => {
    render(
      <ProfileHeader firstName="Аня" totalDays={0} onOpenSettings={() => {}} />,
    );
    expect(screen.queryByText(/в приложении/)).toBeNull();
  });

  it('без имени — использует нейтральное «Я» и первую букву аватара', () => {
    render(
      <ProfileHeader firstName="" totalDays={0} onOpenSettings={() => {}} />,
    );
    expect(screen.getAllByText('Я').length).toBeGreaterThan(0);
  });

  it('1 день — единственное число', () => {
    render(
      <ProfileHeader firstName="Аня" totalDays={1} onOpenSettings={() => {}} />,
    );
    expect(screen.getByText(/1 день в/)).toBeTruthy();
  });

  it('3 дня — «дня» (2-4)', () => {
    render(
      <ProfileHeader firstName="Аня" totalDays={3} onOpenSettings={() => {}} />,
    );
    expect(screen.getByText(/3 дня в/)).toBeTruthy();
  });

  it('10 дней — «дней» (5+)', () => {
    render(
      <ProfileHeader
        firstName="Аня"
        totalDays={10}
        onOpenSettings={() => {}}
      />,
    );
    expect(screen.getByText(/10 дней в/)).toBeTruthy();
  });

  it('клик по кнопке настроек вызывает onOpenSettings', () => {
    const onOpenSettings = vi.fn();
    render(
      <ProfileHeader
        firstName="Аня"
        totalDays={0}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.click(screen.getByLabelText('Настройки'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
