// @vitest-environment jsdom
// Шапка клиента: «в боте / активность / срок / серия» — одна строка текста,
// «оффлайн» и сессия — плашки.
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ClientHeaderBadges } from './ClientHeaderBadges';
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import type { TherapyClientSummary } from '../../api';

afterEach(() => cleanup());

const client = (over: Record<string, unknown> = {}) =>
  ({ telegramId: 7, name: 'Анна', streak: 0, lastActiveDate: null, therapyStartDate: null, nextSession: null, ...over }) as unknown as TherapyClientSummary;
const meta = (c: HTMLElement) => c.querySelector('.tk-meta')?.textContent ?? null;

describe('ClientHeaderBadges', () => {
  it('в боте + активность сегодня + серия — одной строкой через « · », не плашками', () => {
    const { container } = render(
      <ClientHeaderBadges client={client({ daysSinceActive: 0, streak: 12 })} />,
    );
    expect(meta(container)).toBe('в боте · активность сегодня · 12 дн. подряд');
    expect(container.querySelector('.ds-badge')).toBeNull();
  });

  it('«активность сегодня» — по календарю клиента (daysSinceActive), не по дню терапевта (№25)', () => {
    // У клиента в другой зоне уже завтра: lastActiveDate совпадает с «сегодня» терапевта,
    // но сервер посчитал в зоне клиента — вчера. Строка не врёт про «сегодня».
    const { container } = render(
      <ClientHeaderBadges client={client({ lastActiveDate: todayCalendarDate(), daysSinceActive: 1 })} />,
    );
    expect(meta(container)).toBe('в боте');
  });

  it('пустые части пропускаются: без активности, серии и срока остаётся «в боте»', () => {
    const { container } = render(<ClientHeaderBadges client={client()} />);
    expect(meta(container)).toBe('в боте');
  });

  it('срок терапии идёт в строке перед серией', () => {
    const { container } = render(
      <ClientHeaderBadges client={client({ therapyStartDate: '2020-01-15', streak: 3 })} />,
    );
    expect(meta(container)).toMatch(/^в боте · в работе .+ · 3 дн\. подряд$/);
  });

  it('оффлайн — плашка ds-badge, «в боте» нет', () => {
    const { container, getByText } = render(
      <ClientHeaderBadges client={client({ telegramId: -5, streak: 2 })} />,
    );
    expect(getByText('оффлайн').className).toBe('ds-badge');
    expect(meta(container)).toBe('2 дн. подряд');
  });

  it('оффлайн без данных — строки нет совсем', () => {
    const { container } = render(<ClientHeaderBadges client={client({ telegramId: -5 })} />);
    expect(meta(container)).toBeNull();
  });
});
