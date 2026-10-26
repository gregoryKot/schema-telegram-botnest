// @vitest-environment jsdom
// MeetingCard («Встреча с терапевтом» на экране «Сегодня»). Регрессия
// 2026-10-26: клиент видел «Сб, 17 октября · 07:00» при сегодняшнем 26-м —
// nextSession после встречи никто не двигает. Карточка берёт ближайшую
// встречу через shared upcomingSession: прошла — ближайший день встреч с тем
// же временем, дней нет — даты нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TherapyRelationInfo } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';
import { MeetingCard } from './TodayAside';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NOW = '2026-10-26T09:00:00Z'; // понедельник
const SAT = 6;

function relation(nextSession: string | null, meetingDays?: number[]): TherapyRelationInfo {
  return { role: 'client', status: 'active', partnerName: 'Анна', partnerId: 42, code: 'X', nextSession, meetingDays };
}

// Зона ставится раньше системного времени — как в calendarDate.test.ts.
function renderAt(rel: TherapyRelationInfo, check: (tz: string) => void) {
  forEachTimeZone((tz) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    const { unmount } = render(<MeetingCard relation={rel} now={Date.now()} />);
    check(tz);
    unmount();
    vi.useRealTimers();
  });
}

describe('MeetingCard — ближайшая встреча, а не прошедшая', () => {
  it('прошедшая дата + дни встреч → ближайшая суббота с тем же временем', () => {
    renderAt(relation('2026-10-17T07:00', [SAT]), (tz) => {
      expect(screen.getByText('Сб, 31 октября · 07:00'), tz).toBeTruthy();
      expect(screen.queryByText(/17 октября/), tz).toBeNull();
    });
  });

  it('прошедшая дата без дней встреч → даты нет, карточка с терапевтом остаётся', () => {
    for (const days of [[], undefined]) {
      renderAt(relation('2026-10-17T07:00', days), (tz) => {
        expect(screen.getByText('Анна'), tz).toBeTruthy();
        expect(document.querySelector('.ct-meeting-title'), tz).toBeNull();
      });
    }
  });

  it('будущая дата показывается как была, даже если день встреч наступит раньше', () => {
    renderAt(relation('2026-11-04T10:00', [SAT]), (tz) => {
      expect(screen.getByText('Ср, 4 ноября · 10:00'), tz).toBeTruthy();
    });
  });
});
