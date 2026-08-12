// @vitest-environment jsdom
// OnboardingWidget — чеклист «С чего начать» на экране «Сегодня» (0%
// покрытия отдельным файлом до этого теста). Проверяем: скрыт на чистом
// профиле (profile=null) и когда явно скрыт (ONBOARDING_DONE_KEY), реальный
// прогресс из данных профиля (не хардкод), каждый шаг ведёт на правильный
// экран, «отложить»/«вернуть отложенные», состояние «всё пройдено».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OnboardingWidget } from './OnboardingWidget';
import type { UserProfile } from '../../types';

function profile(overrides: Partial<{
  ysqCompleted: boolean; needsTracker: string | null; schemaDiary: string | null;
  notifyEnabled: boolean;
}> = {}): UserProfile {
  return {
    name: null, role: 'CLIENT',
    ysq: { completedAt: overrides.ysqCompleted ? '2026-01-01T00:00:00Z' : null, activeSchemaIds: [] },
    notifications: { enabled: overrides.notifyEnabled ?? false, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: 0,
    lastActivity: {
      needsTracker: overrides.needsTracker ?? null,
      schemaDiary: overrides.schemaDiary ?? null,
      modeDiary: null, gratitudeDiary: null,
    },
    mySchemaIds: [], myModeIds: [],
  };
}

function noopProps() {
  return {
    hasSchemas: false,
    onOpenSchema: vi.fn(),
    onOpenAdvanced: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('OnboardingWidget — видимость', () => {
  it('profile=null (ещё грузится) — ничего не рендерит', () => {
    const { container } = render(<OnboardingWidget profile={null} {...noopProps()} />);
    expect(container.firstChild).toBeNull();
  });

  it('явно скрытый онбординг (ONBOARDING_DONE_KEY) — ничего не рендерит даже с profile', () => {
    localStorage.setItem('onboarding_done', '1');
    const { container } = render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    expect(container.firstChild).toBeNull();
  });

  it('новый профиль без прогресса показывает чеклист «С чего начать»', () => {
    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    expect(screen.getByText('С чего начать')).toBeTruthy();
    expect(screen.getByText('0 из 5 · 5 впереди')).toBeTruthy();
  });
});

describe('OnboardingWidget — прогресс считается из реальных данных профиля (не хардкод)', () => {
  it('пройденный тест на схемы (ysq.completedAt) засчитан как готовый шаг', () => {
    render(<OnboardingWidget profile={profile({ ysqCompleted: true })} {...noopProps()} />);
    expect(screen.getByText('1 из 5 · 4 впереди')).toBeTruthy();
  });

  it('hasSchemas=true тоже засчитывает шаг теста на схемы (альтернативный путь)', () => {
    render(<OnboardingWidget profile={profile()} {...noopProps()} hasSchemas />);
    expect(screen.getByText('1 из 5 · 4 впереди')).toBeTruthy();
  });

  it('заполненный трекер (lastActivity.needsTracker) засчитан отдельным шагом', () => {
    render(<OnboardingWidget profile={profile({ needsTracker: '2026-01-01' })} {...noopProps()} />);
    expect(screen.getByText('1 из 5 · 4 впереди')).toBeTruthy();
  });

  it('колесо детства пройдено (localStorage childhood_wheel_done) засчитано без похода в профиль', () => {
    localStorage.setItem('childhood_wheel_done', '1');
    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    expect(screen.getByText('1 из 5 · 4 впереди')).toBeTruthy();
  });
});

describe('OnboardingWidget — каждый шаг ведёт на свой экран', () => {
  it('«Тест на схемы» → onOpenSchema({ startTest: true })', () => {
    const onOpenSchema = vi.fn();
    render(<OnboardingWidget profile={profile()} {...noopProps()} onOpenSchema={onOpenSchema} />);
    fireEvent.click(screen.getByText('начать →'));
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });

  it('«Оценка потребностей» (второй шаг, тест на схемы уже пройден) → onOpenTracker', () => {
    const onOpenTracker = vi.fn();
    render(<OnboardingWidget profile={profile({ ysqCompleted: true })} {...noopProps()} onOpenTracker={onOpenTracker} />);
    expect(screen.getByText('Оценка потребностей сегодня')).toBeTruthy();
    fireEvent.click(screen.getByText('начать →'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('«Первая запись в дневнике» (первые два шага пройдены) → onOpenDiaries', () => {
    const onOpenDiaries = vi.fn();
    render(
      <OnboardingWidget profile={profile({ ysqCompleted: true, needsTracker: '2026-01-01' })} {...noopProps()} onOpenDiaries={onOpenDiaries} />,
    );
    fireEvent.click(screen.getByText('начать →'));
    expect(onOpenDiaries).toHaveBeenCalledTimes(1);
  });

  it('«Ежедневное напоминание» → onOpenAdvanced', () => {
    const onOpenAdvanced = vi.fn();
    render(
      <OnboardingWidget
        profile={profile({ ysqCompleted: true, needsTracker: '2026-01-01', schemaDiary: '2026-01-01' })}
        {...noopProps()} onOpenAdvanced={onOpenAdvanced}
      />,
    );
    fireEvent.click(screen.getByText('начать →'));
    expect(onOpenAdvanced).toHaveBeenCalledTimes(1);
  });

  it('«Колесо детства» (последний оставшийся шаг) → onOpenChildhoodWheel', () => {
    const onOpenChildhoodWheel = vi.fn();
    render(
      <OnboardingWidget
        profile={profile({ ysqCompleted: true, needsTracker: '2026-01-01', schemaDiary: '2026-01-01', notifyEnabled: true })}
        {...noopProps()} onOpenChildhoodWheel={onOpenChildhoodWheel}
      />,
    );
    expect(screen.getByText('Колесо детства')).toBeTruthy();
    fireEvent.click(screen.getByText('начать →'));
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  it('клавиатура (Enter) на «начать →» тоже запускает действие', () => {
    const onOpenSchema = vi.fn();
    render(<OnboardingWidget profile={profile()} {...noopProps()} onOpenSchema={onOpenSchema} />);
    fireEvent.keyDown(screen.getByText('начать →'), { key: 'Enter' });
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });
});

describe('OnboardingWidget — клик по другому шагу переключает текущий (не открывает сразу)', () => {
  it('клик по строке «Первая запись в дневнике» делает её текущей, показывает её описание', () => {
    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    expect(screen.queryByText('Зафиксировать момент, когда схема сработала – главная практика схема-терапии.')).toBeNull();

    fireEvent.click(screen.getByText('Первая запись в дневнике'));
    expect(screen.getByText('Зафиксировать момент, когда схема сработала – главная практика схема-терапии.')).toBeTruthy();
  });
});

describe('OnboardingWidget — «отложить» переносит шаг в конец очереди', () => {
  it('отложенный шаг помечен «отложено», следующий становится текущим', () => {
    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
    fireEvent.click(screen.getByText('отложить'));

    expect(screen.getByText('отложено')).toBeTruthy();
    // Следующий необработанный шаг стал текущим — его описание видно.
    expect(screen.getByText('Пять оценок – и виден индекс дня. Через неделю паттерн начнёт проявляться в графике.')).toBeTruthy();
  });

  it('отложенный шаг сохраняется в localStorage и переживает перемонтирование', () => {
    const { unmount } = render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    fireEvent.click(screen.getByText('отложить'));
    unmount();

    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    expect(screen.getByText('отложено')).toBeTruthy();
  });

  it('когда все шаги отложены — «вернуть отложенные →» сбрасывает список', () => {
    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('отложить'));
    }
    const restoreLink = screen.getByText('вернуть отложенные →');
    expect(restoreLink).toBeTruthy();

    fireEvent.click(restoreLink);
    expect(screen.queryByText('отложено')).toBeNull();
    expect(screen.queryByText('вернуть отложенные →')).toBeNull();
  });

  it('клавиатура (Enter) на «отложить» тоже откладывает шаг', () => {
    render(<OnboardingWidget profile={profile()} {...noopProps()} />);
    fireEvent.keyDown(screen.getByText('отложить'), { key: 'Enter' });
    expect(screen.getByText('отложено')).toBeTruthy();
  });
});

describe('OnboardingWidget — все шаги пройдены', () => {
  it('показывает «Старт пройден», «скрыть →» прячет виджет насовсем', () => {
    localStorage.setItem('childhood_wheel_done', '1');
    render(
      <OnboardingWidget
        profile={profile({ ysqCompleted: true, needsTracker: '2026-01-01', schemaDiary: '2026-01-01', notifyEnabled: true })}
        {...noopProps()}
      />,
    );
    expect(screen.getByText('Старт пройден')).toBeTruthy();
    expect(screen.queryByText('С чего начать')).toBeNull();

    fireEvent.click(screen.getByText('скрыть →'));
    expect(screen.queryByText('Старт пройден')).toBeNull();
    expect(localStorage.getItem('onboarding_done')).toBe('1');
  });
});
