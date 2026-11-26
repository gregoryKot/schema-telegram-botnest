// @vitest-environment jsdom
// Компонентные тесты DonatePage: сабмит суммы доната, honeypot-поле,
// минимальная сумма, ошибка API. Мок '../api'.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { DonatePage } from './DonatePage';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';

vi.mock('../api', async () => {
  const { ApiError } = await vi.importActual<typeof import('../apiClient')>('../apiClient');
  return { api: { donate: vi.fn() }, ApiError };
});
import { api, ApiError } from '../api';
import { glueSpaces } from '../../../shared/src/utils/typo'; // заголовок PaperOutcome склеивает короткие слова
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function resetLocation() {
  window.history.pushState({}, '', '/donate');
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLocation();
});

afterEach(() => {
  cleanup();
  resetLocation();
});

function honeypotInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="text"]') as HTMLInputElement;
}

describe('DonatePage — выбор суммы', () => {
  it('по умолчанию выбрана сумма 500 ₽', () => {
    render(<DonatePage />);
    expect(screen.getByRole('button', { name: /Поддержать 500/ })).toBeTruthy();
  });

  it('клик по пресету суммы меняет отображаемую сумму на кнопке', () => {
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: '1000 ₽' }));
    expect(screen.getByRole('button', { name: /Поддержать 1[\s ]000/ })).toBeTruthy();
  });
});

describe('DonatePage — сабмит суммы', () => {
  it('вызывает api.donate с введённой суммой, source и email', async () => {
    mockApi.donate.mockResolvedValue({ paymentUrl: null });
    render(<DonatePage />);
    fireEvent.change(screen.getByPlaceholderText('Email для чека (необязательно)'), {
      target: { value: 'donor@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await act(async () => {});

    expect(mockApi.donate).toHaveBeenCalledWith({
      amount: 500,
      source: 'app',
      email: 'donor@example.com',
      website: '',
    });
  });

  it('своя сумма из поля ввода передаётся в api.donate', async () => {
    mockApi.donate.mockResolvedValue({ paymentUrl: null });
    render(<DonatePage />);
    fireEvent.change(screen.getByPlaceholderText('Своя сумма, ₽'), {
      target: { value: '750' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Поддержать 750/ }));

    await act(async () => {});

    expect(mockApi.donate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 750 }),
    );
  });
});

describe('DonatePage — минимальная сумма', () => {
  it('сумма меньше 10 ₽ блокирует кнопку сабмита', () => {
    render(<DonatePage />);
    fireEvent.change(screen.getByPlaceholderText('Своя сумма, ₽'), {
      target: { value: '5' },
    });
    const btn = screen.getByRole('button', { name: /Поддержать 5/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('DonatePage — honeypot-поле', () => {
  it('значение скрытого honeypot-поля передаётся в api.donate как есть', async () => {
    mockApi.donate.mockResolvedValue({ paymentUrl: null });
    const { container } = render(<DonatePage />);
    fireEvent.change(honeypotInput(container), { target: { value: 'bot-filled' } });
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await act(async () => {});

    expect(mockApi.donate).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'bot-filled' }),
    );
  });
});

describe('DonatePage — ошибка API', () => {
  it('ошибка api.donate показывает сообщение об ошибке пользователю', async () => {
    mockApi.donate.mockRejectedValue(new Error('payment gateway down'));
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await screen.findByText('Не получилось. Попробовать ещё раз.');
  });
});

describe('DonatePage — оплата не настроена на сервере (503)', () => {
  it('503 показывает «недоступна», а не призыв повторить', async () => {
    mockApi.donate.mockRejectedValue(new ApiError(503, 'PAYMENT_UNAVAILABLE'));
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await screen.findByText(/Оплата сейчас недоступна/);
    expect(screen.queryByText('Не получилось. Попробовать ещё раз.')).toBeNull();
  });

  it('другая ошибка API (500) по-прежнему просит попробовать ещё раз', async () => {
    mockApi.donate.mockRejectedValue(new ApiError(500, 'boom'));
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await screen.findByText('Не получилось. Попробовать ещё раз.');
    expect(screen.queryByText(/Оплата сейчас недоступна/)).toBeNull();
  });
});

// security#27: Вебвизор визитки не должен писать ввод email (политика
// конфиденциальности обещает обратное) — метка ym-disable-keys, как у формы записи.
describe('DonatePage — Вебвизор не пишет ввод', () => {
  it('поле email несёт ym-disable-keys', () => {
    render(<DonatePage />);
    const email = screen.getByPlaceholderText('Email для чека (необязательно)') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.className).toContain('ym-disable-keys');
  });

  it('поле суммы несёт ym-disable-keys: политика обещает «поля ввода не записываются» без исключений', () => {
    render(<DonatePage />);
    const amount = screen.getByPlaceholderText('Своя сумма, ₽') as HTMLInputElement;
    expect(amount.type).toBe('number');
    expect(amount.className).toContain('ym-disable-keys');
  });
});

// Аудит 2026-10 (AUDIT_2026-10_FINDINGS, «Страница доната говорит „поддержите“»):
// лид-текст звал «поддержите» вне tr() — пользователь с формой «ты» видел «вы».
// /donate публичная и стоит вне RequireAuth/AddressFormProvider (App.tsx), из
// Telegram/MAX уходит во внешний браузер, на визитке — гость: формы у страницы
// нет по построению. Поэтому текст безличный, а не вилка useTr (вне провайдера
// она всегда отдала бы «ты» — баг поменял бы сторону). Третий кейс — шов:
// страница без провайдера, ровно как в App.tsx.
describe('DonatePage — форма обращения', () => {
  const ADDRESS = /(?<![А-Яа-яЁё])поддержи(те)?(?![А-Яа-яЁё])/i;

  function leadWith(form: AddressForm | null): string {
    const page = <DonatePage />;
    const { container } = render(
      form ? <AddressFormContext.Provider value={{ form, setForm: () => {} }}>{page}</AddressFormContext.Provider> : page,
    );
    const text = container.querySelector('.ap-lead')?.textContent ?? '';
    cleanup();
    return text;
  }

  it.each(['ty', 'vy', null] as const)('форма %s: лид без обращения, призыв безличный', (form) => {
    const lead = leadWith(form);
    expect(lead).toContain('можно поддержать любой суммой');
    expect(lead).not.toMatch(ADDRESS);
  });

  it('лид одинаков при «ты», «вы» и без провайдера', () => {
    expect(new Set([leadWith('ty'), leadWith('vy'), leadWith(null)]).size).toBe(1);
  });
});

// #906 → b28: «← На главную» — шапкой ds-sheet-head/ds-back на телефоне и строкой ap-home в колонке формы на
// компьютере; герой — лист соломы со сценой (PayHero), h1 в нём; CTA — одна залитая ds-btn--lg.
describe('DonatePage — каркас и кнопки (#906, b28)', () => {
  it('«← На главную» — ds-back внутри ds-sheet-head и ap-home внизу; h1 в листе-герое; CTA — ds-btn--lg', () => {
    const { container } = render(<DonatePage />);
    const back = screen.getAllByRole('link', { name: 'На главную' });
    expect(back.map((a) => a.className)).toEqual(['ds-back', 'ap-home']);
    expect(back[0].parentElement!.className).toBe('ds-sheet-head ds-sheet-head--page');
    const hero = container.querySelector('.pa-spread-side .ap-sheet')!;
    expect(hero.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
    expect(hero.querySelectorAll('svg.pl2-final-corner--a, svg.pl2-final-corner--b')).toHaveLength(2); // сцена вместо одинокого Leaf
    expect(hero.querySelector('.ap-lead')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Поддержать 500/ }).classList.contains('ds-btn--lg')).toBe(true);
    expect(container.querySelectorAll('.ds-btn--accent')).toHaveLength(1); // одна залитая кнопка
    expect(container.querySelector('.ap-page--center, .ap-card, .ap-btn, .ap-donate-cta, .ap-donate-shell')).toBeNull();
  });

  it('суммы — чипы бумаги: выбранная с галочкой и aria-pressed', () => {
    render(<DonatePage />);
    const on = screen.getByRole('button', { name: '500 ₽' });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.querySelector('[data-sign="check"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '200 ₽' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('DonatePage — возврат с оплаты (?donation=ok|fail)', () => {
  it('?donation=ok: лист «спасибо» с главным действием «На главную», формы нет', () => {
    window.history.pushState({}, '', '/donate?donation=ok');
    const { container } = render(<DonatePage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(glueSpaces('Спасибо за поддержку!'));
    expect(container.querySelector('.pa-thanks')).toBeTruthy();
    const home = screen.getByRole('link', { name: 'На главную' });
    expect(home.getAttribute('href')).toBe('/');
    expect(home.className).toContain('ds-btn');
    expect(screen.queryByRole('button', { name: '1000 ₽' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Поддержать/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('?donation=fail: alert об отказе, заголовок и форма на месте', () => {
    window.history.pushState({}, '', '/donate?donation=fail');
    render(<DonatePage />);
    expect(screen.getByRole('alert').textContent!.replace(/\u00a0/g, ' ')).toContain('Оплата не прошла'); // glue: неразрывные пробелы
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Поддержать проект');
    expect(screen.getByRole('button', { name: '1000 ₽' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Поддержать 500/ })).toBeTruthy();
  });
});

// E14 (аудит 2026-11): «Назад» с Robokassa достаёт страницу из bfcache вместе
// с состоянием — кнопка оставалась в «Перехожу к оплате…» и не нажималась.
describe('DonatePage — возврат «Назад» со страницы оплаты', () => {
  it('pageshow из bfcache снимает «Перехожу к оплате…», кнопка снова жива', async () => {
    mockApi.donate.mockReturnValue(new Promise(() => {})); // ушли на оплату — ответа страница уже не ждёт
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: /Поддержать 500/ }));
    const busy = screen.getByRole('button', { name: 'Перехожу к оплате…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    act(() => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    expect((screen.getByRole('button', { name: /Поддержать 500/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
