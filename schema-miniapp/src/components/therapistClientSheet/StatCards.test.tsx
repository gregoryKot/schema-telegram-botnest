// @vitest-environment jsdom
// StatCards — три сводные цифры над списком клиентов терапевта. Проверяет
// реальный подсчёт (не выдуманные числа): активные — по календарю клиента
// (daysSinceActive === 0 от сервера), оценили — по наличию todayIndex.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatCards } from './StatCards';
import type { TherapyClientSummary } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

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
    render(<StatCards clients={[]} />);
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
        daysSinceActive: 0,
        todayIndex: 7,
      }),
      makeClient({
        telegramId: 2,
        lastActiveDate: '2026-08-02',
        daysSinceActive: 1,
        todayIndex: null,
      }),
      makeClient({
        telegramId: 3,
        lastActiveDate: '2026-08-03',
        daysSinceActive: 0,
        todayIndex: null,
      }),
    ];
    render(<StatCards clients={clients} />);
    expect(screen.getByText('3')).toBeTruthy(); // клиентов
    expect(screen.getByText('2')).toBeTruthy(); // активных сегодня
    expect(screen.getByText('1')).toBeTruthy(); // оценили сегодня
  });

  // QA 2026-10-26: «сегодня» клиента терапевт не знает — в 00:10 по Москве у
  // клиента из Москвы уже 27-е, а день UTC ещё 26-е. Активность считает
  // сервер по календарю клиента; зона терапевта на счёт не влияет, а
  // совпадение lastActiveDate с днём терапевта ничего не значит.
  it('«Активных» — по daysSinceActive, в любой зоне терапевта', () => {
    const clients = [
      makeClient({
        telegramId: 1,
        lastActiveDate: '2026-10-27',
        daysSinceActive: 0,
      }),
      makeClient({
        telegramId: 2,
        lastActiveDate: '2026-10-26',
        daysSinceActive: 1,
      }),
      makeClient({ telegramId: 3, lastActiveDate: '2026-10-26' }), // старый кэш
    ];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T21:10:00Z'));
    forEachTimeZone((tz) => {
      const { container, unmount } = render(<StatCards clients={clients} />);
      const values = [...container.querySelectorAll('.card > div:first-child')];
      expect(
        values.map((v) => v.textContent),
        tz,
      ).toEqual(['3', '1', '0']);
      unmount();
    });
    vi.useRealTimers();
  });

  it('показывает подписи русскими словами, не жаргоном', () => {
    render(<StatCards clients={[]} />);
    expect(screen.getByText('КЛИЕНТОВ')).toBeTruthy();
    expect(screen.getByText('АКТИВНЫХ')).toBeTruthy();
    expect(screen.getByText('ОЦЕНИЛИ')).toBeTruthy();
  });
});
