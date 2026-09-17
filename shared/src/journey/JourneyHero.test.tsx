// @vitest-environment jsdom
// Hero-блоки «Моего пути»: пустое состояние (JourneyEmptyHero) и заполненное
// (JourneyHero с итогом и кнопкой «Поделиться»). Обе формы обращения (ты/вы)
// обязаны попасть в разметку через tr() — иначе пользователь с формой «вы»
// увидит «ты» (правило CLAUDE.md).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JourneyEmptyHero, JourneyHero } from './JourneyHero';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

afterEach(() => {
  cleanup();
});

describe('JourneyEmptyHero', () => {
  it('показывает explainer и обе формы обращения через tr()', () => {
    render(<JourneyEmptyHero tr={tr} explainer="Здесь копится путь." />);
    expect(screen.getByText(/Здесь копится путь/)).toBeTruthy();
    expect(screen.getByText((c) => c.includes('|'))).toBeTruthy();
  });
});

describe('JourneyHero', () => {
  it('показывает итог, explainer и зовёт onShareFeed по клику', () => {
    const onShareFeed = vi.fn();
    render(
      <JourneyHero
        total={12}
        explainer="Собирается здесь, шаг за шагом."
        onShareFeed={onShareFeed}
      />,
    );
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText(/Собирается здесь/)).toBeTruthy();
    fireEvent.click(screen.getByText('Поделиться лентой шагов'));
    expect(onShareFeed).toHaveBeenCalledTimes(1);
  });

  it('total=0 отображается как «0», а не пропадает (не заглушка вместо реальных данных)', () => {
    render(
      <JourneyHero total={0} explainer="Пояснение" onShareFeed={vi.fn()} />,
    );
    expect(screen.getByText('0')).toBeTruthy();
  });
});
