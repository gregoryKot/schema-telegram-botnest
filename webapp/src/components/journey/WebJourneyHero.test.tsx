// @vitest-environment jsdom
// Герой «Моего пути» сайта (b22-journey): лист неба 240 со сценой SceneJourney и числом шагов из данных,
// пусто — ScenePathStart; связка WEB_JOURNEY_KIT (пропс `kit` в JourneyView), знаки строк и плиток —
// по ENTITY_LOOK, деталь — шапка EntitySheet сущности и голос Здорового Взрослого мхом; эмодзи нигде.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { WEB_JOURNEY_KIT } from './webJourneyKit';
import { JourneyView } from '../../../../shared/src/journey/JourneyView';
import type { JourneyState } from '../../../../shared/src/journey/useJourney';

afterEach(cleanup);

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

describe('WebJourneyHero', () => {
  it('показывает реальный итог, пояснение и зовёт onShareFeed', () => {
    const onShareFeed = vi.fn();
    const { Hero } = WEB_JOURNEY_KIT;
    const { container } = render(
      <Hero total={12} explainer="Собирается здесь." onShareFeed={onShareFeed} />,
    );
    expect(screen.getByText('12').className).toBe('jr-hero-num');
    const sheet = container.querySelector('.jr-hero') as HTMLElement;
    expect(sheet.style.getPropertyValue('--h')).toBe('240');
    // сцена стопки листов: листов столько, сколько даёт число шагов (не пусто)
    expect(container.querySelectorAll('.jr-hero-scene [data-sheet]').length).toBeGreaterThan(1);
    expect(screen.getByText('Собирается здесь.')).toBeTruthy();
    fireEvent.click(screen.getByText(/Поделиться лентой шагов/));
    expect(onShareFeed).toHaveBeenCalledTimes(1);
    // editorial: ни градиента, ни эмодзи компаса
    expect(container.innerHTML).not.toContain('gradient');
    expect(container.textContent).not.toContain('🧭');
  });

  it('total=0 остаётся «0», а не пропадает', () => {
    const { Hero } = WEB_JOURNEY_KIT;
    render(<Hero total={0} explainer="Пояснение" onShareFeed={vi.fn()} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('WebJourneyEmptyHero', () => {
  it('пустое состояние слева, без эмодзи, обе формы обращения через tr()', () => {
    const { EmptyHero } = WEB_JOURNEY_KIT;
    const { container } = render(
      <EmptyHero tr={tr} explainer="Здесь копится путь." />,
    );
    expect(screen.getByText('Путь ещё впереди')).toBeTruthy();
    expect(container.querySelectorAll('.jr-hero-scene [data-blank]').length).toBe(3);
    const text = screen.getByText(/Здесь копится путь/).textContent!.replace(/\u00a0/g, ' ');
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
        kit={WEB_JOURNEY_KIT}
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
});
