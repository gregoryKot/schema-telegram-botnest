// @vitest-environment jsdom
// Обёртки вводных карточек: скрытие тумблером, «Библиотека» ведёт на нужную вкладку.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModesHeroSection } from './ModesHeroSection';
import { PatternsHeroSection } from './PatternsHeroSection';
import type { BlockVisibility } from './blockVisibility';

afterEach(cleanup);

const blocks = (hidden: string[] = []): BlockVisibility => ({
  isHidden: (id) => hidden.includes(id),
  holdProps: () => ({}) as ReturnType<BlockVisibility['holdProps']>,
  orderedIds: ['heroes', 'ysq_status'],
});

describe('ModesHeroSection', () => {
  const base = {
    profileLoading: false,
    hasModes: false,
    summary: null,
    onMeetCritic: vi.fn(),
    onShowModePicker: vi.fn(),
    onOpenModeDetail: vi.fn(),
  };

  it('«Что такое режимы» открывает библиотеку на вкладке режимов', () => {
    const onOpenSchema = vi.fn();
    render(
      <ModesHeroSection
        {...base}
        onOpenSchema={onOpenSchema}
        blocks={blocks()}
      />,
    );
    fireEvent.click(screen.getByText('Что такое режимы'));
    expect(onOpenSchema).toHaveBeenCalledWith({ tab: 'modes' });
  });

  it('скрыт тумблером или пока грузится профиль — не рисуется', () => {
    const { container, rerender } = render(
      <ModesHeroSection
        {...base}
        onOpenSchema={vi.fn()}
        blocks={blocks(['heroes'])}
      />,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <ModesHeroSection
        {...base}
        profileLoading
        onOpenSchema={vi.fn()}
        blocks={blocks()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('PatternsHeroSection', () => {
  const base = {
    profileLoading: false,
    hasSchemas: false,
    weekSummary: null,
    ysqProgressAnswered: null,
    ysqCompletedAt: null,
    onShowSchemaPicker: vi.fn(),
    onOpenSchemaDetail: vi.fn(),
  };

  it('«Что такое схемы и режимы» открывает библиотеку, «Начать тест» — тест', () => {
    const onOpenSchema = vi.fn();
    render(
      <PatternsHeroSection
        {...base}
        onOpenSchema={onOpenSchema}
        blocks={blocks()}
      />,
    );
    fireEvent.click(screen.getByText('Что такое схемы и режимы'));
    expect(onOpenSchema).toHaveBeenCalledWith();
    fireEvent.click(screen.getByText('Начать тест'));
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });

  it('скрыт тумблером — карточки теста нет', () => {
    render(
      <PatternsHeroSection
        {...base}
        onOpenSchema={vi.fn()}
        blocks={blocks(['heroes'])}
      />,
    );
    expect(screen.queryByText('Узнать свои схемы')).toBeNull();
  });

  it('схемы есть: карточка теста ведёт в тест', () => {
    const onOpenSchema = vi.fn();
    render(
      <PatternsHeroSection
        {...base}
        hasSchemas
        ysqProgressAnswered={12}
        onOpenSchema={onOpenSchema}
        blocks={blocks()}
      />,
    );
    expect(screen.getByText('Начат · отвечено 12 из 116')).toBeTruthy();
    fireEvent.click(
      screen.getByText(/Продолжить|Пройти|Начать|Тест/, { selector: 'button' }),
    );
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });
});
