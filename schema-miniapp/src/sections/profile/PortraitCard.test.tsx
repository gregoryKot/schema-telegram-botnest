// @vitest-environment jsdom
// PortraitCard — карточка «Мой портрет» вкладки «Я»: бары по доменам (в т.ч.
// нулевые), пустое состояние объясняет откуда/зачем (правило «Онбординг»),
// дельта с прошлого теста без шейминга роста, ссылка на тест без завершения
// YSQ. Вся карточка кликабельна и открывает PortraitSheet — внутренние CTA
// («Пройти тест», «Пройти тест на схемы →») стопают всплытие и зовут
// СВОЙ onOpenPatterns, а не открытие листа (regression: no button-in-button).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PortraitCard } from './PortraitCard';
import type { Portrait } from '../../../../shared/src/portrait/portraitData';

afterEach(cleanup);

function makePortrait(overrides: Partial<Portrait> = {}): Portrait {
  return {
    domains: [
      {
        id: 'rejection',
        label: 'Отвержение',
        color: 'var(--accent-red)',
        count: 0,
      },
      {
        id: 'autonomy',
        label: 'Автономия',
        color: 'var(--accent-orange)',
        count: 0,
      },
      {
        id: 'limits',
        label: 'Границы',
        color: 'var(--accent-yellow)',
        count: 0,
      },
      {
        id: 'other_directed',
        label: 'Ориентация на других',
        color: 'var(--accent-green)',
        count: 0,
      },
      {
        id: 'vigilance',
        label: 'Бдительность',
        color: 'var(--accent-indigo)',
        count: 0,
      },
    ],
    totalSchemas: 0,
    totalModes: 0,
    delta: null,
    ...overrides,
  };
}

describe('PortraitCard — пустое состояние (hasPortraitData=false)', () => {
  it('нет ни одной активной схемы — объясняет откуда/зачем и зовёт пройти тест', () => {
    const onOpenPatterns = vi.fn();
    render(
      <PortraitCard
        portrait={makePortrait()}
        ysqCompletedAt={null}
        onOpenPatterns={onOpenPatterns}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.getByText(/Здесь соберётся/)).toBeTruthy();
    fireEvent.click(screen.getByText('Пройти тест'));
    expect(onOpenPatterns).toHaveBeenCalledTimes(1);
    // Бары доменов не рисуются на пустом состоянии.
    expect(screen.queryByText('Отвержение')).toBeNull();
  });
});

describe('PortraitCard — бары доменов', () => {
  it('рендерит все 5 доменов, включая нулевые (не прячет их)', () => {
    const portrait = makePortrait({
      domains: [
        {
          id: 'rejection',
          label: 'Отвержение',
          color: 'var(--accent-red)',
          count: 3,
        },
        {
          id: 'autonomy',
          label: 'Автономия',
          color: 'var(--accent-orange)',
          count: 0,
        },
        {
          id: 'limits',
          label: 'Границы',
          color: 'var(--accent-yellow)',
          count: 1,
        },
        {
          id: 'other_directed',
          label: 'Ориентация на других',
          color: 'var(--accent-green)',
          count: 0,
        },
        {
          id: 'vigilance',
          label: 'Бдительность',
          color: 'var(--accent-indigo)',
          count: 0,
        },
      ],
      totalSchemas: 4,
      totalModes: 2,
    });
    render(
      <PortraitCard
        portrait={portrait}
        ysqCompletedAt={null}
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.getByText('Отвержение')).toBeTruthy();
    expect(screen.getByText('Автономия')).toBeTruthy();
    expect(screen.getByText('Границы')).toBeTruthy();
    expect(screen.getByText('Ориентация на других')).toBeTruthy();
    expect(screen.getByText('Бдительность')).toBeTruthy();
    // Заголовок: «N схем · M режимов».
    expect(screen.getByText(/4 схемы · 2 режима/)).toBeTruthy();
  });

  it('нет завершённого теста, но есть данные — вместо даты ссылка «Пройти тест на схемы →»', () => {
    const onOpenPatterns = vi.fn();
    const portrait = makePortrait({
      domains: [
        {
          id: 'rejection',
          label: 'Отвержение',
          color: 'var(--accent-red)',
          count: 1,
        },
        {
          id: 'autonomy',
          label: 'Автономия',
          color: 'var(--accent-orange)',
          count: 0,
        },
        {
          id: 'limits',
          label: 'Границы',
          color: 'var(--accent-yellow)',
          count: 0,
        },
        {
          id: 'other_directed',
          label: 'Ориентация на других',
          color: 'var(--accent-green)',
          count: 0,
        },
        {
          id: 'vigilance',
          label: 'Бдительность',
          color: 'var(--accent-indigo)',
          count: 0,
        },
      ],
      totalSchemas: 1,
    });
    render(
      <PortraitCard
        portrait={portrait}
        ysqCompletedAt={null}
        onOpenPatterns={onOpenPatterns}
        onOpenSheet={() => {}}
      />,
    );
    const link = screen.getByText('Пройти тест на схемы →');
    fireEvent.click(link);
    expect(onOpenPatterns).toHaveBeenCalledTimes(1);
  });
});

describe('PortraitCard — дельта с прошлого теста', () => {
  const portrait = makePortrait({
    domains: [
      {
        id: 'rejection',
        label: 'Отвержение',
        color: 'var(--accent-red)',
        count: 2,
      },
      {
        id: 'autonomy',
        label: 'Автономия',
        color: 'var(--accent-orange)',
        count: 0,
      },
      {
        id: 'limits',
        label: 'Границы',
        color: 'var(--accent-yellow)',
        count: 0,
      },
      {
        id: 'other_directed',
        label: 'Ориентация на других',
        color: 'var(--accent-green)',
        count: 0,
      },
      {
        id: 'vigilance',
        label: 'Бдительность',
        color: 'var(--accent-indigo)',
        count: 0,
      },
    ],
    totalSchemas: 2,
  });

  it('delta < 0 — «−N с прошлого теста» без слова «хуже»/осуждения', () => {
    render(
      <PortraitCard
        portrait={{ ...portrait, delta: -3 }}
        ysqCompletedAt="2026-08-01T00:00:00.000Z"
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.getByText(/-3 с прошлого теста/)).toBeTruthy();
  });

  it('delta > 0 — «+N с прошлого теста», без стыдящего оформления (нейтральный текст)', () => {
    render(
      <PortraitCard
        portrait={{ ...portrait, delta: 2 }}
        ysqCompletedAt="2026-08-01T00:00:00.000Z"
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.getByText(/\+2 с прошлого теста/)).toBeTruthy();
  });

  it('delta = null или 0 — чип не рендерится вовсе', () => {
    render(
      <PortraitCard
        portrait={{ ...portrait, delta: null }}
        ysqCompletedAt="2026-08-01T00:00:00.000Z"
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.queryByText(/с прошлого теста/)).toBeNull();

    cleanup();
    render(
      <PortraitCard
        portrait={{ ...portrait, delta: 0 }}
        ysqCompletedAt="2026-08-01T00:00:00.000Z"
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.queryByText(/с прошлого теста/)).toBeNull();
  });
});

describe('PortraitCard — вся карточка кликабельна, открывает лист (правило «Онбординг»)', () => {
  it('тап по карточке (не по внутренней кнопке) зовёт onOpenSheet', () => {
    const onOpenSheet = vi.fn();
    const portrait = makePortrait({ totalSchemas: 1 });
    render(
      <PortraitCard
        portrait={portrait}
        ysqCompletedAt="2026-08-01T00:00:00.000Z"
        onOpenPatterns={() => {}}
        onOpenSheet={onOpenSheet}
      />,
    );
    fireEvent.click(screen.getByText('Мой портрет'));
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
  });

  it('заголовок несёт шеврон-аффорданс (визуальный сигнал кликабельности)', () => {
    render(
      <PortraitCard
        portrait={makePortrait()}
        ysqCompletedAt={null}
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(screen.getByText('›')).toBeTruthy();
  });

  it('клик по «Пройти тест» (пустое состояние) зовёт СВОЙ onOpenPatterns, не onOpenSheet (stopPropagation)', () => {
    const onOpenPatterns = vi.fn();
    const onOpenSheet = vi.fn();
    render(
      <PortraitCard
        portrait={makePortrait()}
        ysqCompletedAt={null}
        onOpenPatterns={onOpenPatterns}
        onOpenSheet={onOpenSheet}
      />,
    );
    fireEvent.click(screen.getByText('Пройти тест'));
    expect(onOpenPatterns).toHaveBeenCalledTimes(1);
    expect(onOpenSheet).not.toHaveBeenCalled();
  });

  it('клик по «Пройти тест на схемы →» зовёт СВОЙ onOpenPatterns, не onOpenSheet (stopPropagation)', () => {
    const onOpenPatterns = vi.fn();
    const onOpenSheet = vi.fn();
    const portrait = makePortrait({
      totalSchemas: 1,
      domains: [
        {
          id: 'rejection',
          label: 'Отвержение',
          color: 'var(--accent-red)',
          count: 1,
        },
        {
          id: 'autonomy',
          label: 'Автономия',
          color: 'var(--accent-orange)',
          count: 0,
        },
        {
          id: 'limits',
          label: 'Границы',
          color: 'var(--accent-yellow)',
          count: 0,
        },
        {
          id: 'other_directed',
          label: 'Ориентация на других',
          color: 'var(--accent-green)',
          count: 0,
        },
        {
          id: 'vigilance',
          label: 'Бдительность',
          color: 'var(--accent-indigo)',
          count: 0,
        },
      ],
    });
    render(
      <PortraitCard
        portrait={portrait}
        ysqCompletedAt={null}
        onOpenPatterns={onOpenPatterns}
        onOpenSheet={onOpenSheet}
      />,
    );
    fireEvent.click(screen.getByText('Пройти тест на схемы →'));
    expect(onOpenPatterns).toHaveBeenCalledTimes(1);
    expect(onOpenSheet).not.toHaveBeenCalled();
  });
});
