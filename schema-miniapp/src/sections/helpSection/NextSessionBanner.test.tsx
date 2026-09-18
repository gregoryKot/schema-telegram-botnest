// @vitest-environment jsdom
// NextSessionBanner — баннер следующей встречи с терапевтом. Проверяет
// гейт по роли (терапевт сам себе баннер не видит), сегодняшнюю встречу
// (акцентный цвет + «Сегодня встреча») и обычную дату с/без времени.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NextSessionBanner } from './NextSessionBanner';
import type { TherapyRelationInfo } from '../../api';
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NextSessionBanner — гейты видимости', () => {
  it('relation отсутствует — ничего не рендерит', () => {
    const { container } = render(<NextSessionBanner relation={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('роль "therapist" (не клиент) — баннер скрыт', () => {
    const relation = {
      role: 'therapist',
      nextSession: '2026-08-10',
    } as unknown as TherapyRelationInfo;
    const { container } = render(<NextSessionBanner relation={relation} />);
    expect(container.firstChild).toBeNull();
  });

  it('клиент без назначенной встречи — баннер скрыт', () => {
    const relation = {
      role: 'client',
      nextSession: null,
    } as unknown as TherapyRelationInfo;
    const { container } = render(<NextSessionBanner relation={relation} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('NextSessionBanner — содержимое', () => {
  it('встреча сегодня — акцентный текст «Сегодня встреча»', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T09:00:00Z'));
    const relation = {
      role: 'client',
      nextSession: '2026-08-10',
    } as unknown as TherapyRelationInfo;
    render(<NextSessionBanner relation={relation} />);
    expect(screen.getByText('Сегодня встреча')).toBeTruthy();
  });

  it('встреча в будущем — дата и время в подписи', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T09:00:00Z'));
    // 2026-08-10 — понедельник
    const relation = {
      role: 'client',
      nextSession: '2026-08-10T15:30:00',
    } as unknown as TherapyRelationInfo;
    render(<NextSessionBanner relation={relation} />);
    expect(screen.getByText('Встреча: Пн, 10 авг · 15:30:00')).toBeTruthy();
  });

  it('показывает имя партнёра/терапевта, если оно передано', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T09:00:00Z'));
    const relation = {
      role: 'client',
      nextSession: '2026-08-10',
      partnerName: 'Анна Петровна',
    } as unknown as TherapyRelationInfo;
    render(<NextSessionBanner relation={relation} />);
    expect(screen.getByText('с Анна Петровна')).toBeTruthy();
  });
});

describe('NextSessionBanner — «сегодня» сверяется с календарным днём UTC, а не зоной машины (инцидент 2026-09-17)', () => {
  // Моменты зафиксированы там, где локальная дата машины заведомо расходится
  // с UTC: в Сиднее это уже 19-е, в Лос-Анджелесе ещё 18-е — тест краснеет
  // в любой час прогона, а не только когда TZ раннера случайно не совпал с UTC.
  it('nextSession на сегодняшний календарный день сервера — «Сегодня встреча» в любой зоне', () => {
    for (const at of ['2026-09-18T23:30:00Z', '2026-09-19T00:30:00Z']) {
      // Зона ставится раньше системного времени — тем же порядком, что и в
      // shared/src/utils/calendarDate.test.ts.
      forEachTimeZone((tz) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(at));
        const relation = {
          role: 'client',
          nextSession: todayCalendarDate(),
        } as unknown as TherapyRelationInfo;
        const { unmount } = render(<NextSessionBanner relation={relation} />);
        expect(
          screen.getByText('Сегодня встреча'),
          `${at} / ${tz}`,
        ).toBeTruthy();
        unmount();
        vi.useRealTimers();
      });
    }
  });
});
