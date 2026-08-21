// @vitest-environment jsdom
// PortraitCard — карточка «Мой портрет» вкладки «Я»: бары по пяти базовым
// потребностям (в т.ч. нулевые), онбординг-подпись «что это» под заголовком
// (правило «Онбординг и очевидность»), пустое состояние объясняет
// откуда/зачем, дельта с прошлого теста без шейминга роста, ссылка на тест
// без завершения YSQ. Вся карточка кликабельна и открывает PortraitSheet —
// внутренние CTA («Пройти тест», «Пройти тест на схемы →») стопают всплытие
// и зовут СВОЙ onOpenPatterns, а не открытие листа (regression: no
// button-in-button).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PortraitCard } from './PortraitCard';
import type { Portrait } from '../../../../shared/src/portrait/portraitData';

afterEach(cleanup);

function makePortrait(overrides: Partial<Portrait> = {}): Portrait {
  return {
    needs: [
      {
        id: 'attachment',
        label: 'Привязанность',
        emoji: '🤝',
        color: '#ff6b9d',
        count: 0,
      },
      {
        id: 'autonomy',
        label: 'Автономия',
        emoji: '🧭',
        color: '#4fa3f7',
        count: 0,
      },
      {
        id: 'expression',
        label: 'Выражение чувств',
        emoji: '💬',
        color: '#facc15',
        count: 0,
      },
      {
        id: 'play',
        label: 'Спонтанность',
        emoji: '🎉',
        color: '#06d6a0',
        count: 0,
      },
      {
        id: 'limits',
        label: 'Границы',
        emoji: '⚖️',
        color: '#a78bfa',
        count: 0,
      },
    ],
    totalSchemas: 0,
    totalModes: 0,
    delta: null,
    ...overrides,
  };
}

describe('PortraitCard — онбординг-подпись под заголовком', () => {
  it('всегда объясняет «что это», независимо от наличия данных', () => {
    render(
      <PortraitCard
        portrait={makePortrait()}
        ysqCompletedAt={null}
        onOpenPatterns={() => {}}
        onOpenSheet={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /Сколько твоих активных схем стоит за каждой из пяти потребностей/,
      ),
    ).toBeTruthy();
  });
});

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
    // Бары потребностей не рисуются на пустом состоянии.
    expect(screen.queryByText('Привязанность')).toBeNull();
  });
});

describe('PortraitCard — бары потребностей', () => {
  it('рендерит все 5 потребностей с эмодзи, включая нулевые (не прячет их)', () => {
    const portrait = makePortrait({
      needs: [
        {
          id: 'attachment',
          label: 'Привязанность',
          emoji: '🤝',
          color: '#ff6b9d',
          count: 3,
        },
        {
          id: 'autonomy',
          label: 'Автономия',
          emoji: '🧭',
          color: '#4fa3f7',
          count: 0,
        },
        {
          id: 'expression',
          label: 'Выражение чувств',
          emoji: '💬',
          color: '#facc15',
          count: 1,
        },
        {
          id: 'play',
          label: 'Спонтанность',
          emoji: '🎉',
          color: '#06d6a0',
          count: 0,
        },
        {
          id: 'limits',
          label: 'Границы',
          emoji: '⚖️',
          color: '#a78bfa',
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
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('Автономия')).toBeTruthy();
    expect(screen.getByText('Выражение чувств')).toBeTruthy();
    expect(screen.getByText('Спонтанность')).toBeTruthy();
    expect(screen.getByText('Границы')).toBeTruthy();
    expect(screen.getByText('🤝')).toBeTruthy();
    // Заголовок: «N схем · M режимов».
    expect(screen.getByText(/4 схемы · 2 режима/)).toBeTruthy();
  });

  it('нет завершённого теста, но есть данные — вместо даты ссылка «Пройти тест на схемы →»', () => {
    const onOpenPatterns = vi.fn();
    const portrait = makePortrait({
      needs: [
        {
          id: 'attachment',
          label: 'Привязанность',
          emoji: '🤝',
          color: '#ff6b9d',
          count: 1,
        },
        {
          id: 'autonomy',
          label: 'Автономия',
          emoji: '🧭',
          color: '#4fa3f7',
          count: 0,
        },
        {
          id: 'expression',
          label: 'Выражение чувств',
          emoji: '💬',
          color: '#facc15',
          count: 0,
        },
        {
          id: 'play',
          label: 'Спонтанность',
          emoji: '🎉',
          color: '#06d6a0',
          count: 0,
        },
        {
          id: 'limits',
          label: 'Границы',
          emoji: '⚖️',
          color: '#a78bfa',
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
    needs: [
      {
        id: 'attachment',
        label: 'Привязанность',
        emoji: '🤝',
        color: '#ff6b9d',
        count: 2,
      },
      {
        id: 'autonomy',
        label: 'Автономия',
        emoji: '🧭',
        color: '#4fa3f7',
        count: 0,
      },
      {
        id: 'expression',
        label: 'Выражение чувств',
        emoji: '💬',
        color: '#facc15',
        count: 0,
      },
      {
        id: 'play',
        label: 'Спонтанность',
        emoji: '🎉',
        color: '#06d6a0',
        count: 0,
      },
      {
        id: 'limits',
        label: 'Границы',
        emoji: '⚖️',
        color: '#a78bfa',
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
      needs: [
        {
          id: 'attachment',
          label: 'Привязанность',
          emoji: '🤝',
          color: '#ff6b9d',
          count: 1,
        },
        {
          id: 'autonomy',
          label: 'Автономия',
          emoji: '🧭',
          color: '#4fa3f7',
          count: 0,
        },
        {
          id: 'expression',
          label: 'Выражение чувств',
          emoji: '💬',
          color: '#facc15',
          count: 0,
        },
        {
          id: 'play',
          label: 'Спонтанность',
          emoji: '🎉',
          color: '#06d6a0',
          count: 0,
        },
        {
          id: 'limits',
          label: 'Границы',
          emoji: '⚖️',
          color: '#a78bfa',
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
