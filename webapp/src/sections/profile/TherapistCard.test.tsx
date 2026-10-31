// @vitest-environment jsdom
// Карточка «Терапевт» профиля: при живой связи — терапевт; связи нет, а
// терапевт отказался от роли — сообщение о бывшем (решение владельца 2026-10-22).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { TherapyRelationInfo } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

const getFormerTherapist = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { getFormerTherapist } }));

import { TherapistCard } from './TherapistCard';

afterEach(() => {
  cleanup();
  getFormerTherapist.mockReset();
  vi.useRealTimers();
});

const active: TherapyRelationInfo = {
  role: 'client',
  status: 'active',
  partnerName: 'Мария',
  partnerId: 9,
  code: 'ABC',
  nextSession: null,
};

describe('TherapistCard', () => {
  it('связи нет, бывший терапевт есть — сообщение с именем', async () => {
    getFormerTherapist.mockResolvedValue({ name: 'Анна', endedAt: null });
    render(<TherapistCard relation={null} />);
    expect(
      await screen.findByText('Анна больше не работает в приложении как терапевт'),
    ).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('Подключить другого терапевта можно по коду');
  });

  it('связи нет и бывшего нет (null) — пусто', async () => {
    getFormerTherapist.mockResolvedValue(null);
    const { container } = render(<TherapistCard relation={null} />);
    await waitFor(() => expect(getFormerTherapist).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe('');
  });

  it('связь активна — карточка терапевта, бывшего не спрашиваем', () => {
    render(<TherapistCard relation={active} />);
    expect(screen.getByText('Мария')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(getFormerTherapist).not.toHaveBeenCalled();
  });
});

// Регрессия 2026-10-26: «Следующая сессия: Сб, 17 окт» при сегодняшнем 26-м —
// nextSession после встречи никто не двигает. Карточка берёт ближайшую
// встречу через shared upcomingSession.
describe('TherapistCard — «Следующая сессия» не в прошлом', () => {
  const SAT = 6;
  function renderAt(rel: TherapyRelationInfo, check: (tz: string) => void) {
    forEachTimeZone((tz) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T09:00:00Z')); // понедельник
      const { unmount } = render(<TherapistCard relation={rel} />);
      check(tz);
      unmount();
      vi.useRealTimers();
    });
  }

  it('прошедшая дата + дни встреч → ближайшая суббота с тем же временем', () => {
    renderAt({ ...active, nextSession: '2026-10-17T07:00', meetingDays: [SAT] }, (tz) => {
      expect(screen.getByText('Сб, 31 окт · 07:00'), tz).toBeTruthy();
      expect(screen.queryByText(/17 окт/), tz).toBeNull();
    });
  });

  it('прошедшая дата без дней встреч → строки «Следующая сессия» нет', () => {
    for (const meetingDays of [[], undefined]) {
      renderAt({ ...active, nextSession: '2026-10-17T07:00', meetingDays }, (tz) => {
        expect(screen.getByText('Мария'), tz).toBeTruthy();
        expect(screen.queryByText('Следующая сессия'), tz).toBeNull();
      });
    }
  });

  it('будущая дата — как была', () => {
    renderAt({ ...active, nextSession: '2026-11-04T10:00', meetingDays: [SAT] }, (tz) => {
      expect(screen.getByText('Ср, 4 ноя · 10:00'), tz).toBeTruthy();
    });
  });
});
