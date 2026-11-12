// @vitest-environment jsdom
// Карточка «Терапевт» профиля: при живой связи — терапевт; связи нет, а
// терапевт отказался от роли — сообщение о бывшем (решение владельца 2026-10-22).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TherapyRelationInfo } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

const getFormerTherapist = vi.hoisted(() => vi.fn());
// Запись из приложения (#546): по умолчанию — раздела нет (не клиент владельца).
const getClientBooking = vi.hoisted(() => vi.fn());
const getSlots = vi.hoisted(() => vi.fn());
const getBookingOptions = vi.hoisted(() => vi.fn()); // цена в листе записи (R9)
const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { getFormerTherapist, getClientBooking, getSlots, getBookingOptions, trackEvent } }));
vi.mock('../../components/booking/useClientTimeZone', () => ({ useClientTimeZone: () => ['Europe/Moscow', vi.fn()] }));

import { TherapistCard } from './TherapistCard';

beforeEach(() => {
  getClientBooking.mockResolvedValue({ eligible: false, upcoming: [] });
  getSlots.mockResolvedValue([]);
  getBookingOptions.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  getFormerTherapist.mockReset();
  getClientBooking.mockReset();
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

/** Строка «когда» билета сессии: день и время — в своих span, текст строки целый («Вс, 15 ноя · 18:00»). */
const when = (text: string | RegExp) => screen.getByText((_c, el) =>
  !!el?.classList.contains('cbk-ticket-when') && (typeof text === 'string' ? el.textContent === text : text.test(el.textContent ?? '')));

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
      expect(when('Сб, 31 окт · 07:00'), tz).toBeTruthy();
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
      expect(when('Ср, 4 ноя · 10:00'), tz).toBeTruthy();
    });
  });
});

// Запись клиента из приложения (#546): кнопка — только клиенту владельца
// практики (eligible от сервера); своя бронь — в карточке вместо даты от
// терапевта, с «Управлять записью».
describe('TherapistCard — запись на сессию', () => {
  const booking = {
    startsAt: '2026-11-10T13:00:00.000Z', durationMin: 50, status: 'CONFIRMED' as const,
    heldUntil: null, manageUrl: 'https://kotlarewski.gr/booking/manage?token=tok',
  };
  const renderCard = (rel: TherapyRelationInfo) =>
    render(<MemoryRouter><TherapistCard relation={rel} /></MemoryRouter>);

  it('не клиент владельца — кнопки записи нет', async () => {
    renderCard(active);
    await waitFor(() => expect(getClientBooking).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Записаться на сессию' })).toBeNull();
  });

  it('клиент владельца — кнопка открывает лист записи', async () => {
    getClientBooking.mockResolvedValue({ eligible: true, upcoming: [] });
    renderCard(active);
    fireEvent.click(await screen.findByRole('button', { name: 'Записаться на сессию' }));
    expect(screen.getByRole('dialog', { name: 'Запись на сессию' })).toBeTruthy();
    expect(trackEvent).toHaveBeenCalledWith('client_booking_opened');
  });

  it('своя бронь — «Ближайшая сессия» из брони вместо даты терапевта, со ссылкой управления', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T09:00:00Z'));
    getClientBooking.mockResolvedValue({ eligible: true, upcoming: [booking] });
    renderCard({ ...active, nextSession: '2026-11-20T10:00' });
    await screen.findByText('Ближайшая сессия');
    expect(when('Завтра, 16:00')).toBeTruthy();
    expect(screen.getByText('Запись подтверждена')).toBeTruthy();
    expect(screen.queryByText('Следующая сессия')).toBeNull();
    expect(screen.getByRole('link', { name: 'Управлять записью' }).getAttribute('href')).toBe(booking.manageUrl);
  });

  it('связь кончилась, а бронь осталась — бронь видна, кнопки нет', async () => {
    getClientBooking.mockResolvedValue({ eligible: false, upcoming: [booking] });
    renderCard(active);
    expect(await screen.findByText('Ближайшая сессия')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Записаться на сессию' })).toBeNull();
  });
});
