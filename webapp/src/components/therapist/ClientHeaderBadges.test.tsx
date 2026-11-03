// @vitest-environment jsdom
// Шапка клиента: «в боте / активность / срок / серия» — одна строка текста,
// «офлайн» — плашка, ближайшая встреча — строка «Встреча» + дата (#906), не
// заливной бейдж.
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
      <ClientHeaderBadges client={client({ lastActiveDate: todayCalendarDate(), streak: 12 })} />,
    );
    expect(meta(container)).toBe('в боте · активность сегодня · 12 дн. подряд');
    expect(container.querySelector('.ds-badge')).toBeNull();
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

  it('офлайн — плашка ds-badge, «в боте» нет', () => {
    const { container, getByText } = render(
      <ClientHeaderBadges client={client({ telegramId: -5, streak: 2 })} />,
    );
    expect(getByText('офлайн').className).toBe('ds-badge');
    expect(meta(container)).toBe('2 дн. подряд');
  });

  it('офлайн без данных — строки нет совсем', () => {
    const { container } = render(<ClientHeaderBadges client={client({ telegramId: -5 })} />);
    expect(meta(container)).toBeNull();
  });

  it('ближайшая встреча — ярлык «Встреча» и дата акцентом, заливного бейджа нет', () => {
    const { container, getByText } = render(
      <ClientHeaderBadges client={client({ nextSession: '2999-01-05T10:00', meetingDays: [] })} />,
    );
    expect(getByText('Встреча').className).toBe('ds-label');
    expect(container.querySelector('.tc-meeting-val')!.textContent).toContain('10:00');
    expect(container.querySelector('.ds-badge--accent')).toBeNull();
    expect(container.textContent).not.toContain('Сессия ·');
  });

  it('встречи нет — строки «Встреча» нет', () => {
    const { container } = render(<ClientHeaderBadges client={client()} />);
    expect(container.querySelector('.tc-meeting')).toBeNull();
  });
});
