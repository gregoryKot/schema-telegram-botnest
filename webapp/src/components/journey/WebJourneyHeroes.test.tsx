// @vitest-environment jsdom
// Герой «Моего пути» сайта: editorial-вёрстка (без градиента и эмодзи),
// регистрация в реестре (journeyHeroes.ts) и сквозной путь JourneyView →
// герой сайта. Мини-апп берёт градиентный JourneyHero.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { registerWebJourneyHeroes } from './registerWebJourneyHeroes';
import { journeyHeroes } from '../../../../shared/src/journey/journeyHeroes';
import { JourneyView } from '../../../../shared/src/journey/JourneyView';
import type { JourneyState } from '../../../../shared/src/journey/useJourney';

registerWebJourneyHeroes();
afterEach(cleanup);

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

describe('WebJourneyHero', () => {
  it('показывает реальный итог, пояснение и зовёт onShareFeed', () => {
    const onShareFeed = vi.fn();
    const { Hero } = journeyHeroes;
    const { container } = render(
      <Hero total={12} explainer="Собирается здесь." onShareFeed={onShareFeed} />,
    );
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Собирается здесь.')).toBeTruthy();
    fireEvent.click(screen.getByText(/Поделиться лентой шагов/));
    expect(onShareFeed).toHaveBeenCalledTimes(1);
    // editorial: ни градиента, ни эмодзи компаса
    expect(container.innerHTML).not.toContain('gradient');
    expect(container.textContent).not.toContain('🧭');
  });

  it('total=0 остаётся «0», а не пропадает', () => {
    const { Hero } = journeyHeroes;
    render(<Hero total={0} explainer="Пояснение" onShareFeed={vi.fn()} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('WebJourneyEmptyHero', () => {
  it('пустое состояние слева, без эмодзи, обе формы обращения через tr()', () => {
    const { EmptyHero } = journeyHeroes;
    const { container } = render(
      <EmptyHero tr={tr} explainer="Здесь копится путь." />,
    );
    expect(screen.getByText('Путь ещё впереди')).toBeTruthy();
    const text = screen.getByText(/Здесь копится путь/).textContent;
    expect(text).toContain('Начни с трекера');
    expect(text).toContain('Начните с трекера');
    expect(container.textContent).not.toContain('🧭');
  });
});

describe('JourneyView на сайте', () => {
  const view = (total: number) => {
    const j: JourneyState = {
      data: { counts: {} as never, items: [] },
      failed: false,
      sortDir: 'desc',
      setSortDir: vi.fn(),
      group: 'all',
      setGroup: vi.fn(),
      period: 'all',
      setPeriod: vi.fn(),
      stats: [],
      total,
      items: [],
    };
    return (
      <JourneyView
        tr={tr}
        j={j}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />
    );
  };

  it('с записями рисует героя сайта', () => {
    render(view(5));
    expect(screen.getByText('Шагов заботы о себе')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('пустой путь — пустой герой сайта', () => {
    render(view(0));
    expect(screen.getByText('Путь ещё впереди')).toBeTruthy();
  });

  it('шов: App.tsx подключает регистрацию героя сайта (без неё шапки нет)', () => {
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');
    expect(app).toMatch(/^registerWebJourneyHeroes\(\);/m);
  });
});
