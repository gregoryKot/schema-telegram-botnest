// @vitest-environment jsdom
// «С чего начать» на телефоне: счётчик + одна карточка текущего шага (как в
// мини-аппе), а не весь чеклист. Десктопный чеклист — в OnboardingWidget.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OnboardingWidget } from './OnboardingWidget';
import type { UserProfile } from '../../types';

vi.mock('../../components/useIsMobile', () => ({ useIsMobile: () => true }));

function profile(over: { ysq?: boolean; tracker?: boolean; diary?: boolean; notify?: boolean } = {}): UserProfile {
  return {
    name: null, role: 'CLIENT',
    ysq: { completedAt: over.ysq ? '2026-01-01T00:00:00Z' : null, activeSchemaIds: [] },
    notifications: { enabled: !!over.notify, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: 0,
    lastActivity: {
      needsTracker: over.tracker ? '2026-01-01' : null,
      schemaDiary: over.diary ? '2026-01-01' : null,
      modeDiary: null, gratitudeDiary: null,
    },
    mySchemaIds: [], myModeIds: [],
  };
}

function setup(p: UserProfile) {
  const props = {
    hasSchemas: false,
    onOpenSchema: vi.fn(), onOpenAdvanced: vi.fn(), onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(), onOpenChildhoodWheel: vi.fn(),
  };
  render(<OnboardingWidget profile={p} {...props} />);
  return props;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('OnboardingWidget на телефоне', () => {
  it('одна карточка первого шага, остальные шаги не перечислены', () => {
    setup(profile());
    expect(screen.getByText('0 из 5 шагов выполнено')).toBeTruthy();
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    expect(screen.getByText('20 схем · история прохождений · советы')).toBeTruthy();
    expect(screen.queryByText('Колесо детства')).toBeNull();
    expect(screen.getByRole('button', { name: 'Позже' })).toBeTruthy();
  });

  it('текущий шаг — первый невыполненный, счётчик из данных профиля', () => {
    setup(profile({ ysq: true, tracker: true }));
    expect(screen.getByText('2 из 5 шагов выполнено')).toBeTruthy();
    expect(screen.getByText('Первая запись в дневнике')).toBeTruthy();
  });

  it('главная кнопка ведёт на экран шага', () => {
    const p = setup(profile({ ysq: true, tracker: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Открыть дневник' }));
    expect(p.onOpenDiaries).toHaveBeenCalledTimes(1);
  });

  it('«Позже» откладывает шаг и показывает следующий; решение запоминается', () => {
    setup(profile());
    fireEvent.click(screen.getByRole('button', { name: 'Позже' }));
    expect(screen.getByText('Оценка потребностей сегодня')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('onboarding_skipped') ?? '[]')).toEqual(['ysq']);
  });

  it('точка прогресса открывает выбранный шаг; у отложенного кнопка «Вернуть»', () => {
    setup(profile());
    fireEvent.click(screen.getByRole('button', { name: 'Позже' }));
    fireEvent.click(screen.getByRole('button', { name: 'Шаг «Тест на схемы», отложен' }));
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть' }));
    expect(localStorage.getItem('onboarding_skipped')).toBeNull();
  });

  it('выполненный шаг показывает «Выполнено» вместо кнопок', () => {
    setup(profile({ ysq: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Шаг «Тест на схемы», выполнен' }));
    expect(screen.getByText('✓ Выполнено')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Позже' })).toBeNull();
  });

  it('все оставшиеся шаги отложены — компактная карточка «Продолжить»', () => {
    setup(profile({ ysq: true, tracker: true, diary: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Позже' }));
    fireEvent.click(screen.getByRole('button', { name: 'Позже' }));
    expect(screen.getByText('2 шага отложено')).toBeTruthy();
    expect(screen.getByText('3 из 5 выполнено')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByText('Ежедневное напоминание')).toBeTruthy();
    expect(localStorage.getItem('onboarding_skipped')).toBeNull();
  });
});
