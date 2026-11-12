// @vitest-environment jsdom
// Лист «Запись на сессию» (#546): до первого действия — откуда окна и что
// после оплаты; пока грузится — силуэт ленты, пусто — «терапевт откроет слоты»
// и «Написать терапевту»; выбор времени → «Записаться на HH:mm» → api.clientBook
// со слотом и поясом; дальше — оплата по ссылке или «Записано»; тексты — в
// форме обращения пользователя.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';

vi.mock('../../api', () => ({
  api: { getSlots: vi.fn(), getBookingOptions: vi.fn(), clientBook: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
const zone = vi.hoisted(() => ({ tz: 'Europe/Moscow' }));
vi.mock('./useClientTimeZone', () => ({ useClientTimeZone: () => [zone.tz, vi.fn()] }));
vi.mock('../../lib/metrika', () => ({ trackGoal: vi.fn(), trackGoalOnce: vi.fn() }));
import { api, reportClientError } from '../../api';
import { ClientBookingSheet } from './ClientBookingSheet';
import { setChosenCurrency } from './priceCurrency';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const SLOT = { startsAt: '2026-11-10T13:00:00.000Z', endsAt: '2026-11-10T13:50:00.000Z', durationMin: 50 };
const SESSION = { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 4000, prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 }, note: '' };

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSlots.mockResolvedValue([SLOT]);
  mockApi.getBookingOptions.mockResolvedValue([SESSION]);
  zone.tz = 'Europe/Moscow';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T09:00:00Z'));
});
afterEach(() => {
  cleanup();
  act(() => setChosenCurrency(null));
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
    expect(screen.getByText(/из календаря терапевта/).textContent?.replace(/\u00a0/g, ' ')).toContain('время останется за тобой');
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

  // R9: цена видна до «Записаться» — раньше лист её не показывал вовсе.
  it('цена до записи: пояс России — рубли с оплатой онлайн, выбора валюты нет', async () => {
    renderSheet();
    expect(await screen.findByText('Сессия — 4 000 ₽, оплата картой или СБП сразу после записи.')).toBeTruthy();
    expect(screen.queryByText('Я не в России — показать цену')).toBeNull();
  });

  // R9: при поясе без места — тот же выбор валюты, что у формы на визитке, и
  // он уходит в запись (сервер примет его только при таком поясе).
  it('пояс без места: выбор евро меняет цену и уходит в clientBook', async () => {
    zone.tz = 'UTC';
    mockApi.clientBook.mockResolvedValue({
      cancelToken: 'tok', status: 'CONFIRMED', heldUntil: null, paymentUrl: null,
      manageUrl: 'https://kotlarewski.gr/booking/manage?token=tok',
    });
    renderSheet('ty');
    expect(await screen.findByText(/^Сессия — 4 000 ₽/)).toBeTruthy();
    expect(screen.getByText(/Если ты не в России, выбери валюту/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'в евро €' }));
    expect(screen.getByText('Сессия — 65 €, запись подтвердится сразу: об оплате терапевт напишет перед встречей.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '13:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Записаться на 13:00' }));
    await waitFor(() => expect(mockApi.clientBook).toHaveBeenCalledWith({
      startsAt: SLOT.startsAt, durationMin: 50, clientTimeZone: 'UTC', currency: 'EUR',
    }));
  });

  it('цена ещё грузится — силуэт строки, а не пустота и не дефолтная цена', async () => {
    mockApi.getBookingOptions.mockReturnValue(new Promise(() => {}));
    renderSheet();
    await screen.findByRole('button', { name: '16:00' });
    expect(document.querySelector('.cbk-inner .skel')).not.toBeNull();
    expect(screen.queryByText(/^Сессия — /)).toBeNull();
  });

  it('цена не загрузилась — строки цены нет, сбой ушёл наверх, записаться можно', async () => {
    mockApi.getBookingOptions.mockRejectedValue(new Error('500'));
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: '16:00' }));
    await waitFor(() => expect(reportClientError).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/^Сессия — /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Записаться на 16:00' })).toBeTruthy();
  });

  it('время заняли — честная строка в форме «ты», выбор другого времени её снимает', async () => {
    const { ApiError } = await import('../../apiClient');
    mockApi.clientBook.mockRejectedValue(new ApiError(409, 'Slot taken'));
    renderSheet('ty');
    fireEvent.click(await screen.findByRole('button', { name: '16:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Записаться на 16:00' }));
    expect((await screen.findByRole('alert')).textContent?.replace(/\u00a0/g, ' ')).toBe('Это время только что заняли — выбери другое.');
    fireEvent.click(screen.getByRole('button', { name: '16:00' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ClientBookingSheet — фокус клавиатуры', () => {
  it('открытие переносит фокус в лист, Tab с последнего элемента возвращается на первый, закрытие — к вызвавшей кнопке', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const view = render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <ClientBookingSheet onClose={vi.fn()} onBooked={vi.fn()} writeUrl={null} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Запись на сессию' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const close = screen.getByRole('button', { name: '← Закрыть' });
    expect(document.activeElement).toBe(close);
    await screen.findByRole('button', { name: '16:00' });
    const all = [...dialog.querySelectorAll<HTMLElement>('button, a[href]')];
    all.at(-1)!.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
