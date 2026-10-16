// @vitest-environment jsdom
// Компонентные тесты SubscribePage: сабмит формы подписки, honeypot-поле,
// обязательное согласие (consent), ошибка API. Мок '../api' — образец сетапа
// webapp/src/utils/addressForm.test.tsx / schema-miniapp TrackerOverlay.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { SubscribePage } from './SubscribePage';

vi.mock('../api', () => ({
  api: {
    getSubscriptionOptions: vi.fn(),
    getSubscriptionByToken: vi.fn(),
    subscribe: vi.fn(),
    cancelSubscription: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
import { ApiError } from '../apiClient';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const OPTIONS = {
  enabled: true,
  options: [
    { period: 'month' as const, price: 299 },
    { period: 'year' as const, price: 2990 },
  ],
};

function resetLocation() {
  window.history.pushState({}, '', '/subscribe');
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLocation();
  mockApi.getSubscriptionOptions.mockResolvedValue(OPTIONS);
});

afterEach(() => {
  cleanup();
  resetLocation();
});

async function renderLoaded() {
  render(<SubscribePage />);
  // Дожидаемся загрузки опций подписки (useEffect -> api.getSubscriptionOptions).
  await screen.findByText('299 ₽');
}

function honeypotInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="text"]') as HTMLInputElement;
}

describe('SubscribePage — загрузка опций', () => {
  it('показывает цену выбранного периода после загрузки api.getSubscriptionOptions', async () => {
    await renderLoaded();
    expect(screen.getByText('299 ₽')).toBeTruthy();
  });
});

describe('SubscribePage — согласие обязательно', () => {
  it('кнопка «Оформить» задизейблена, пока не отмечено согласие', async () => {
    await renderLoaded();
    const btn = screen.getByRole('button', { name: /Оформить за/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('после отметки согласия кнопка становится активной', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('checkbox'));
    const btn = screen.getByRole('button', { name: /Оформить за/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('SubscribePage — сабмит подписки', () => {
  it('вызывает api.subscribe с введённым email, периодом и acceptedOffer=true', async () => {
    mockApi.subscribe.mockResolvedValue({ paymentUrl: null });
    await renderLoaded();
    fireEvent.change(screen.getByPlaceholderText('Email для чека (необязательно)'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Оформить за/ }));

    await act(async () => {});

    expect(mockApi.subscribe).toHaveBeenCalledWith({
      period: 'month',
      email: 'user@example.com',
      acceptedOffer: true,
      website: '',
    });
  });

  it('переключение на «Год» передаёт period: year и годовую цену в тексте кнопки', async () => {
    mockApi.subscribe.mockResolvedValue({ paymentUrl: null });
    await renderLoaded();
    fireEvent.click(screen.getByRole('radio', { name: /Год/ }));
    expect(screen.getByRole('button', { name: /Оформить за 2\s990/ })).toBeTruthy();
  });
});

describe('SubscribePage — honeypot-поле', () => {
  it('значение скрытого honeypot-поля передаётся в api.subscribe как есть', async () => {
    mockApi.subscribe.mockResolvedValue({ paymentUrl: null });
    const { container } = render(<SubscribePage />);
    await screen.findByText('299 ₽');

    fireEvent.change(honeypotInput(container), { target: { value: 'bot-filled' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Оформить за/ }));

    await act(async () => {});

    expect(mockApi.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'bot-filled' }),
    );
  });
});

describe('SubscribePage — ошибка API', () => {
  it('ошибка api.subscribe показывает сообщение об ошибке пользователю', async () => {
    mockApi.subscribe.mockRejectedValue(new Error('payment gateway down'));
    await renderLoaded();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Оформить за/ }));

    await screen.findByText('Не получилось. Попробовать ещё раз.');
  });
});

describe('SubscribePage — управление подпиской по токену (сбой ≠ пусто)', () => {
  // Регрессия (правило №14, экран-тупик): раньше `sub === null` на отказе
  // отрисовывал «Загружаем…» навсегда — отказ было не отличить от загрузки.
  it('провал api.getSubscriptionByToken показывает ошибку вместо вечной «Загружаем…»', async () => {
    mockApi.getSubscriptionByToken.mockRejectedValue(new Error('network'));
    window.history.pushState({}, '', '/subscribe?token=tok1');
    render(<SubscribePage />);

    await screen.findByText(/Не удалось загрузить подписку/);
    expect(screen.queryByText('Загружаем…')).toBeNull();
  });

  it('кнопка «Обновить» на экране ошибки перезагружает страницу', async () => {
    // window.location.reload не переопределяется через vi.spyOn в jsdom
    // (навигация — не конфигурируемое свойство) — подменяем сам объект
    // location, как в AuthCallback.test.tsx, и восстанавливаем после теста.
    mockApi.getSubscriptionByToken.mockRejectedValue(new Error('network'));
    window.history.pushState({}, '', '/subscribe?token=tok1');
    const originalLocation = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
    try {
      render(<SubscribePage />);
      await screen.findByText(/Не удалось загрузить подписку/);
      fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
      expect(reload).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  it('успешная загрузка подписки по токену показывает управление, а не ошибку', async () => {
    mockApi.getSubscriptionByToken.mockResolvedValue({ status: 'active', period: 'month', amount: 299, nextChargeAt: null });
    window.history.pushState({}, '', '/subscribe?token=tok1');
    render(<SubscribePage />);

    await screen.findByText('Подписка');
    expect(screen.queryByText(/Не удалось загрузить подписку/)).toBeNull();
  });
});

// security#27: Вебвизор визитки не должен писать ввод email (политика
// конфиденциальности обещает обратное) — метка ym-disable-keys, как у формы записи.
describe('SubscribePage — Вебвизор не пишет ввод', () => {
  it('поле email несёт ym-disable-keys', async () => {
    render(<SubscribePage />);
    const email = (await screen.findByPlaceholderText('Email для чека (необязательно)')) as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.className).toContain('ym-disable-keys');
  });
});

describe('SubscribePage — отмена подписки (отказ не глотается, аудит 2026-10-11 frontends#0)', () => {
  const ACTIVE = { status: 'active', period: 'month', amount: 299, nextChargeAt: '2026-11-01T00:00:00Z' };

  async function openManage() {
    mockApi.getSubscriptionByToken.mockResolvedValue(ACTIVE);
    window.history.pushState({}, '', '/subscribe?token=tok1');
    render(<SubscribePage />);
    await screen.findByText(/Следующее списание/);
  }
  const cancelBtn = () => screen.getByRole('button', { name: /Отменить подписку|Отменяю/ }) as HTMLButtonElement;

  it('контроль: успешная отмена показывает «Подписка отменена»', async () => {
    mockApi.cancelSubscription.mockResolvedValue({ ok: true });
    await openManage();
    fireEvent.click(cancelBtn());
    await screen.findByText('Подписка отменена');
    expect(mockApi.cancelSubscription).toHaveBeenCalledWith('tok1');
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('отказ сервера: текст ошибки виден, «Подписка отменена» нет, кнопка снова активна, отчёт наверх', async () => {
    mockApi.cancelSubscription.mockRejectedValue(new ApiError(500, 'Internal server error'));
    await openManage();
    fireEvent.click(cancelBtn());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не получилось отменить подписку/);
    expect(alert.textContent).toMatch(/списания не остановлены/);
    expect(alert.querySelector('a')?.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(screen.queryByText('Подписка отменена')).toBeNull();
    expect(cancelBtn().disabled).toBe(false);
    expect(cancelBtn().textContent).toBe('Отменить подписку');
    expect(reportClientError).toHaveBeenCalledWith({ message: 'subscription cancel failed: HTTP 500', section: 'subscription' });
  });

  it('в отчёт не попадает токен ссылки', async () => {
    mockApi.cancelSubscription.mockRejectedValue(new ApiError(429, 'tok1 too many'));
    await openManage();
    fireEvent.click(cancelBtn());
    await screen.findByRole('alert');
    expect(JSON.stringify(vi.mocked(reportClientError).mock.calls)).not.toContain('tok1');
  });

  it('404: «ссылка устарела», без отчёта наверх (ожидаемый исход)', async () => {
    mockApi.cancelSubscription.mockRejectedValue(new ApiError(404, 'Subscription not found'));
    await openManage();
    fireEvent.click(cancelBtn());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Ссылка устарела/);
    expect(alert.textContent).not.toMatch(/Не получилось/);
    expect(screen.queryByText('Подписка отменена')).toBeNull();
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('пока запрос в полёте, кнопка заблокирована, второй клик не шлёт второй POST', async () => {
    let finish!: (v: { ok: true }) => void;
    mockApi.cancelSubscription.mockReturnValue(new Promise((r) => { finish = r; }));
    await openManage();
    fireEvent.click(cancelBtn());
    expect(cancelBtn().disabled).toBe(true);
    expect(cancelBtn().textContent).toBe('Отменяю…');
    fireEvent.click(cancelBtn());
    expect(mockApi.cancelSubscription).toHaveBeenCalledTimes(1);

    await act(async () => { finish({ ok: true }); });
    await screen.findByText('Подписка отменена');
  });

  it('повторная попытка после отказа убирает старый текст ошибки', async () => {
    mockApi.cancelSubscription.mockRejectedValueOnce(new ApiError(500, 'x')).mockResolvedValueOnce({ ok: true });
    await openManage();
    fireEvent.click(cancelBtn());
    await screen.findByRole('alert');
    fireEvent.click(cancelBtn());
    await screen.findByText('Подписка отменена');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
