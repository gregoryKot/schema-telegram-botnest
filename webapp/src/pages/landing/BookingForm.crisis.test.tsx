// @vitest-environment jsdom
// Правило №7: свободный текст формы записи на визитке проходит через
// кризисный путь (аудит 2026-10, frontends#5). Раньше человек, написавший в
// «Запрос» «не хочу больше жить», получал «Заявка отправлена… отвечу утром» и
// ни одного телефона. Тесты идут по настоящему DOM формы: ввод → карточка до
// отправки → экран результата с той же карточкой.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingForm } from './BookingForm';

vi.mock('../../api', () => ({
  api: { submitBooking: vi.fn(), trackPublicEvent: vi.fn(), trackEvent: vi.fn() },
}));
import { api } from '../../api';
import { setMetrikaSessionPossible } from '../../lib/metrikaGate';
setMetrikaSessionPossible(false);
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const HOTLINE = '8-800-100-49-94';
const PLACEHOLDER = 'Пара слов о том, с чем хотите разобраться';

function typeRequest(text: string) {
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: text } });
}
async function submitWith(text: string) {
  fireEvent.change(screen.getByLabelText('Имя *'), { target: { value: 'Ира' } });
  fireEvent.change(screen.getByLabelText('Где вам удобнее отвечать *'), { target: { value: '@ira' } });
  typeRequest(text);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /Написать/ }));
  await screen.findByText('Заявка отправлена');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.submitBooking.mockResolvedValue({ ok: true });
});
afterEach(() => cleanup());

describe('BookingForm — кризисный путь поля «Запрос»', () => {
  it.each([
    'не хочу больше жить, всё бессмысленно',
    'не вижу смысла жить дальше', // фраза из находки: раньше детектор её не ловил
    'смысла жить нет',
  ])('«%s»: карточка с телефоном доверия появляется ДО отправки', (text) => {
    render(<BookingForm />);
    expect(screen.queryByText(HOTLINE)).toBeNull();
    typeRequest(text);
    expect(screen.getByText(HOTLINE)).toBeTruthy();
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('карточка говорит «вы»: посетитель визитки не вошёл, формы обращения у него нет', () => {
    render(<BookingForm />);
    typeRequest('не хочу больше жить');
    expect(screen.getByText(/Вы не обязаны справляться с этим в одиночку/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('позвони на'); // «ты»-императив
  });

  it('карточка уходит, когда кризисный текст стёрт', () => {
    render(<BookingForm />);
    typeRequest('не хочу больше жить');
    typeRequest('хочу разобраться с тревогой');
    expect(screen.queryByText(HOTLINE)).toBeNull();
  });

  it('карточка не блокирует отправку: текст уходит как есть, на экране «Заявка отправлена» она остаётся', async () => {
    render(<BookingForm />);
    await submitWith('не хочу больше жить');
    expect(mockApi.submitBooking).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'не хочу больше жить' }),
    );
    // Худшее место прежней версии: «отвечу утром» и ни одного телефона.
    expect(screen.getByText(/отвечу утром/)).toBeTruthy();
    expect(screen.getByText(HOTLINE)).toBeTruthy();
  });

  it('контроль: обычный запрос карточку не показывает ни при вводе, ни после отправки', async () => {
    render(<BookingForm />);
    typeRequest('тревога на работе');
    expect(screen.queryByText(HOTLINE)).toBeNull();
    await submitWith('тревога на работе');
    expect(screen.queryByText(HOTLINE)).toBeNull();
    expect(document.body.textContent).not.toMatch(/телефон доверия/i);
    expect(mockApi.trackPublicEvent).not.toHaveBeenCalled();
  });

  it('контроль: пустой «Запрос» (необязательное поле) — карточки нет', async () => {
    render(<BookingForm />);
    await submitWith('');
    expect(screen.queryByText(HOTLINE)).toBeNull();
  });
});

describe('BookingForm — аналитика кризисной карточки (правило №8)', () => {
  it('показ уходит анонимным путём (посетитель не вошёл) с surface=booking и без текста', () => {
    render(<BookingForm />);
    typeRequest('не хочу больше жить');
    expect(mockApi.trackPublicEvent).toHaveBeenCalledWith('crisis_card_shown', { surface: 'booking' });
    expect(JSON.stringify(mockApi.trackPublicEvent.mock.calls)).not.toContain('жить');
    // Авторизованный /api/event посетителю закрыт (401) — через него не шлём.
    expect(mockApi.trackEvent).not.toHaveBeenCalled();
  });

  it('нажатие на телефон доверия — crisis_hotline_tapped с surface=booking', () => {
    render(<BookingForm />);
    typeRequest('не хочу больше жить');
    fireEvent.click(screen.getByText(HOTLINE));
    expect(mockApi.trackPublicEvent).toHaveBeenCalledWith('crisis_hotline_tapped', { surface: 'booking' });
  });
});
