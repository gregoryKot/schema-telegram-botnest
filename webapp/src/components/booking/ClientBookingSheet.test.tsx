// @vitest-environment jsdom
// Лист «Запись на сессию» (#546): до первого действия — откуда окна и что
// после оплаты; пока грузится — силуэт ленты, пусто — «терапевт откроет слоты»
// и «Написать терапевту»; выбор времени → «Записаться на HH:mm» → api.clientBook
// со слотом и поясом; дальше — оплата по ссылке или «Записано»; тексты — в
// форме обращения пользователя.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';

vi.mock('../../api', () => ({
  api: { getSlots: vi.fn(), clientBook: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
vi.mock('./useClientTimeZone', () => ({ useClientTimeZone: () => ['Europe/Moscow', vi.fn()] }));
import { api } from '../../api';
import { ClientBookingSheet } from './ClientBookingSheet';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const SLOT = { startsAt: '2026-11-10T13:00:00.000Z', endsAt: '2026-11-10T13:50:00.000Z', durationMin: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSlots.mockResolvedValue([SLOT]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T09:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderSheet(form: 'ty' | 'vy' = 'vy', writeUrl: string | null = 'tg://user?id=42') {
  const onBooked = vi.fn();
  render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <ClientBookingSheet onClose={vi.fn()} onBooked={onBooked} writeUrl={writeUrl} />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
  return { onBooked };
}

describe('ClientBookingSheet', () => {
  it('открытие — событие client_booking_opened и объяснение «откуда и что после оплаты»', async () => {
    renderSheet('ty');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('client_booking_opened');
    expect(screen.getByText(/из календаря терапевта/).textContent).toContain('время останется за тобой');
    await screen.findByText('Выбери день');
  });

  it('пока грузится — силуэт ленты, а не текст и не пустота', () => {
    mockApi.getSlots.mockReturnValue(new Promise(() => {}));
    renderSheet();
    expect(document.querySelector('.cbk-skel')).not.toBeNull();
    expect(screen.queryByText(/Свободного времени пока нет/)).toBeNull();
  });

  it('слотов нет — «терапевт откроет слоты» и «Написать терапевту»', async () => {
    mockApi.getSlots.mockResolvedValue([]);
    renderSheet();
    expect(await screen.findByText('Свободного времени пока нет — терапевт откроет слоты.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Написать терапевту' }).getAttribute('href')).toBe('tg://user?id=42');
  });

  it('канала у терапевта нет — пустое состояние без мёртвой ссылки', async () => {
    mockApi.getSlots.mockResolvedValue([]);
    renderSheet('vy', null);
    await screen.findByText(/Свободного времени пока нет/);
    expect(screen.queryByRole('link', { name: 'Написать терапевту' })).toBeNull();
  });

  it('выбор времени → «Записаться на 16:00» с офертой рядом → clientBook со слотом и поясом → оплата', async () => {
    mockApi.clientBook.mockResolvedValue({
      cancelToken: 'tok', status: 'HELD', heldUntil: '2026-11-09T09:15:00.000Z',
      paymentUrl: 'https://auth.robokassa.ru/pay?x=1', manageUrl: 'https://kotlarewski.gr/booking/manage?token=tok',
    });
    const { onBooked } = renderSheet();
    expect(screen.queryByRole('button', { name: /^Записаться на/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: '16:00' }));
    expect(screen.getByText(/Нажимая «Записаться», вы принимаете условия/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'оферты' }).getAttribute('href')).toBe('/offer');
    fireEvent.click(screen.getByRole('button', { name: 'Записаться на 16:00' }));
    await waitFor(() => expect(mockApi.clientBook).toHaveBeenCalledWith({
      startsAt: SLOT.startsAt, durationMin: 50, clientTimeZone: 'Europe/Moscow',
    }));
    const pay = await screen.findByRole('link', { name: 'Перейти к оплате' });
    expect(pay.getAttribute('href')).toBe('https://auth.robokassa.ru/pay?x=1');
    expect(screen.getByRole('link', { name: 'Управлять записью' }).getAttribute('href')).toContain('token=tok');
    // Ссылки с секретами (оплата, токен управления) — под ym-hide-content, как у записи на визитке.
    for (const name of ['Перейти к оплате', 'Управлять записью'])
      expect(screen.getByRole('link', { name }).closest('.ym-hide-content')).not.toBeNull();
    expect(onBooked).toHaveBeenCalledTimes(1);
  });

  it('без оплаты (не рубли) — сразу «Записано» и управление записью', async () => {
    mockApi.clientBook.mockResolvedValue({
      cancelToken: 'tok', status: 'CONFIRMED', heldUntil: null, paymentUrl: null,
      manageUrl: 'https://kotlarewski.gr/booking/manage?token=tok',
    });
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: '16:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Записаться на 16:00' }));
    expect((await screen.findByRole('heading', { level: 2 })).textContent).toBe('Записано: Завтра, 16:00');
    expect(screen.queryByRole('link', { name: 'Перейти к оплате' })).toBeNull();
  });

  it('время заняли — честная строка в форме «ты», выбор другого времени её снимает', async () => {
    const { ApiError } = await import('../../apiClient');
    mockApi.clientBook.mockRejectedValue(new ApiError(409, 'Slot taken'));
    renderSheet('ty');
    fireEvent.click(await screen.findByRole('button', { name: '16:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Записаться на 16:00' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Это время только что заняли — выбери другое.');
    fireEvent.click(screen.getByRole('button', { name: '16:00' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
