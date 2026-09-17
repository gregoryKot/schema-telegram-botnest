// @vitest-environment jsdom
// StatCards — три сводные цифры над списком клиентов терапевта. Проверяет
// реальный подсчёт (не выдуманные числа): активные — по совпадению даты с
// «сегодня», оценили — по наличию todayIndex именно сегодня.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatCards } from './StatCards';
import type { TherapyClientSummary } from '../../api';

afterEach(() => {
  cleanup();
});

function makeClient(
  overrides: Partial<TherapyClientSummary> = {},
): TherapyClientSummary {
  return {
    telegramId: 1,
    name: 'Клиент',
    clientAlias: null,
    streak: 0,
    lastActiveDate: null,
    todayIndex: null,
    recentIndexHistory: [],
    relationCreatedAt: '2026-01-01',
    therapyStartDate: null,
    nextSession: null,
    meetingDays: [],
    schemaIds: [],
    ...overrides,
  };
}

describe('StatCards — на пустом списке клиентов', () => {
  it('все три счётчика — 0, а не пусто/NaN', () => {
    render(<StatCards clients={[]} today="2026-08-03" />);
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(3);
  });
});

describe('StatCards — реальный подсчёт', () => {
  it('считает клиентов, активных сегодня и оценивших сегодня раздельно', () => {
    const clients = [
      makeClient({
        telegramId: 1,
        lastActiveDate: '2026-08-03',
        todayIndex: 7,
      }),
      makeClient({
        telegramId: 2,
        lastActiveDate: '2026-08-02',
        todayIndex: null,
      }),
      makeClient({
        telegramId: 3,
        lastActiveDate: '2026-08-03',
        todayIndex: null,
      }),
    ];
    render(<StatCards clients={clients} today="2026-08-03" />);
    expect(screen.getByText('3')).toBeTruthy(); // клиентов
    expect(screen.getByText('2')).toBeTruthy(); // активных сегодня
    expect(screen.getByText('1')).toBeTruthy(); // оценили сегодня
  });

  it('показывает подписи русскими словами, не жаргоном', () => {
    render(<StatCards clients={[]} today="2026-08-03" />);
    expect(screen.getByText('КЛИЕНТОВ')).toBeTruthy();
    expect(screen.getByText('АКТИВНЫХ')).toBeTruthy();
    expect(screen.getByText('ОЦЕНИЛИ')).toBeTruthy();
  });
});
