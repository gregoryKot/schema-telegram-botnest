// @vitest-environment jsdom
// Онбординг-виджет экрана трекера (CLAUDE.md — приоритет покрытия «экраны
// трекера»; правило «онбординг и очевидность» — виджет объясняет, куда идти
// дальше). Поведение: null пока профиль не загружен, терминальные состояния
// (всё пройдено / всё отложено), переход по шагу и «Позже»/«Вернуть».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OnboardingWidget } from './OnboardingWidget';
import { ONBOARDING_DONE_KEY, ONBOARDING_SKIPPED_KEY } from './onboardingSteps';
import type { UserProfile } from '../../types';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
});

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: null,
    role: 'CLIENT',
    ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: {
      enabled: false,
      reminderEnabled: false,
      timezone: 'Europe/Moscow',
      localHour: 20,
    },
    streak: 0,
    lastActivity: {
      needsTracker: null,
      schemaDiary: null,
      modeDiary: null,
      gratitudeDiary: null,
    },
    mySchemaIds: [],
    myModeIds: [],
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<React.ComponentProps<typeof OnboardingWidget>> = {},
) {
  return {
    profile: profile(),
    hasSchemas: false,
    onOpenSchema: vi.fn(),
    onOpenAdvanced: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
    ...overrides,
  };
}

describe('OnboardingWidget', () => {
  it('профиль ещё не загружен (null) — ничего не рендерит', () => {
    const { container } = render(
      <OnboardingWidget {...baseProps({ profile: null })} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('онбординг скрыт локально (ONBOARDING_DONE_KEY) — ничего не рендерит', () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, '1');
    const { container } = render(<OnboardingWidget {...baseProps()} />);
    expect(container.innerHTML).toBe('');
  });

  it('первый незавершённый шаг — тест на схемы, счётчик 0 из 5', () => {
    render(<OnboardingWidget {...baseProps()} />);
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    expect(screen.getByText('0 из 5 шагов выполнено')).toBeTruthy();
  });

  it('профиль без ysq (урезанный ответ сервера) не роняет виджет — шаг просто не засчитан', () => {
    // Регрессия из браузерного смока #375: `p?.ysq.completedAt` защищал только
    // profile, но не ysq — TypeError до первого рендера, белый экран «Сегодня».
    const partial = {
      ...profile(),
      ysq: undefined,
    } as unknown as ReturnType<typeof profile>;
    render(<OnboardingWidget {...baseProps({ profile: partial })} />);
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
  });

  it('клик «Начать тест» открывает тест на схемы через onOpenSchema', () => {
    const onOpenSchema = vi.fn();
    render(<OnboardingWidget {...baseProps({ onOpenSchema })} />);
    fireEvent.click(screen.getByText('Начать тест'));
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });

  it('тест уже пройден — следующий шаг трекер, счётчик учитывает пройденное', () => {
    render(
      <OnboardingWidget
        {...baseProps({
          profile: profile({
            ysq: { completedAt: '2026-08-01', activeSchemaIds: [] },
          }),
        })}
      />,
    );
    expect(screen.getByText('Оценка потребностей сегодня')).toBeTruthy();
    expect(screen.getByText('1 из 5 шагов выполнено')).toBeTruthy();
  });

  it('клик «Позже» откладывает текущий шаг — следующий шаг занимает его место', () => {
    render(<OnboardingWidget {...baseProps()} />);
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    fireEvent.click(screen.getByText('Позже'));
    expect(screen.getByText('Оценка потребностей сегодня')).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem(ONBOARDING_SKIPPED_KEY) ?? '[]'),
    ).toEqual(['ysq']);
  });

  it('все шаги пройдены — терминальная карточка успеха, «Скрыть» прячет виджет навсегда', () => {
    localStorage.setItem('childhood_wheel_done', '1');
    render(
      <OnboardingWidget
        {...baseProps({
          hasSchemas: true,
          profile: profile({
            ysq: {
              completedAt: '2026-08-01',
              activeSchemaIds: ['abandonment'],
            },
            lastActivity: {
              needsTracker: '2026-08-01',
              schemaDiary: '2026-08-01',
              modeDiary: null,
              gratitudeDiary: null,
            },
            notifications: {
              enabled: true,
              reminderEnabled: true,
              timezone: 'Europe/Moscow',
              localHour: 20,
            },
          }),
        })}
      />,
    );
    expect(screen.getByText('Все шаги пройдены')).toBeTruthy();
    fireEvent.click(screen.getByText('Скрыть'));
    expect(localStorage.getItem(ONBOARDING_DONE_KEY)).toBe('1');
  });

  it('все оставшиеся шаги отложены — свёрнутая карточка «продолжить»', () => {
    localStorage.setItem(
      ONBOARDING_SKIPPED_KEY,
      JSON.stringify(['ysq', 'tracker', 'diary', 'notify', 'childhood']),
    );
    render(<OnboardingWidget {...baseProps()} />);
    expect(screen.getByText('шага отложено', { exact: false })).toBeTruthy();
    expect(screen.getByText('из 5 выполнено', { exact: false })).toBeTruthy();
  });

  it('«Продолжить» на свёрнутой карточке сбрасывает отложенные шаги', () => {
    localStorage.setItem(
      ONBOARDING_SKIPPED_KEY,
      JSON.stringify(['ysq', 'tracker', 'diary', 'notify', 'childhood']),
    );
    render(<OnboardingWidget {...baseProps()} />);
    fireEvent.click(screen.getByText('Продолжить'));
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    expect(localStorage.getItem(ONBOARDING_SKIPPED_KEY)).toBeNull();
  });

  it('клик по точке шага открывает его выбранным вручную', () => {
    render(<OnboardingWidget {...baseProps()} />);
    // Точки шагов — pressable-элементы без текста; кликаем по последней (childhood).
    const dots = screen.getAllByRole('button').filter((el) => !el.textContent);
    fireEvent.click(dots[dots.length - 1]);
    expect(screen.getByText('Колесо детства')).toBeTruthy();
  });
});
