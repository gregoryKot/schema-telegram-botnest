// @vitest-environment jsdom
// Компонентные тесты TwoFactorSection (2FA): включение (QR → код →
// recovery-коды), отключение, ошибки каждого шага. Мокаем global fetch —
// образец: AccountPage.test.tsx (родительская страница, тот же паттерн).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TwoFactorSection } from './TwoFactorSection';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderSection(totp = { enabled: false, recoveryCodesLeft: 0 }, onChanged = vi.fn()) {
  return { onChanged, ...render(<TwoFactorSection accessToken="tok123" totp={totp} onChanged={onChanged} />) };
}

describe('TwoFactorSection — выключена (пустое состояние)', () => {
  it('показывает объяснение и переключатель (выключен), без recovery-кодов', () => {
    renderSection();
    expect(screen.getByText(/Дополнительный код из приложения/)).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
});

describe('TwoFactorSection — включена (реальные данные)', () => {
  it('показывает "Включена" и реальный остаток recovery-кодов из props, не выдуманный', () => {
    renderSection({ enabled: true, recoveryCodesLeft: 4 });
    expect(screen.getByText(/Включена/)).toBeTruthy();
    expect(screen.getByText(/Recovery-кодов осталось: 4/)).toBeTruthy();
  });
});

describe('TwoFactorSection — настройка (setup)', () => {
  it('клик «Включить 2FA» запрашивает /api/auth/2fa/setup и показывает QR', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { qrDataUrl: 'data:image/png;base64,x', otpauthUrl: 'otpauth://totp/x' }));
    renderSection();

    fireEvent.click(screen.getByRole('switch'));

    await screen.findByAltText('TOTP QR');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/2fa/setup');
  });

  it('ошибка при старте настройки показывает сообщение, QR не появляется', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Сервис недоступен' }));
    renderSection();

    fireEvent.click(screen.getByRole('switch'));

    await screen.findByText('Сервис недоступен');
    expect(screen.queryByAltText('TOTP QR')).toBeNull();
  });

  it('подтверждение верным кодом вызывает /api/auth/2fa/enable и показывает recovery-коды', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { qrDataUrl: 'data:x', otpauthUrl: 'otpauth://x' }))
      .mockResolvedValueOnce(jsonResponse(200, { recoveryCodes: ['AAAA-1111', 'BBBB-2222'] }));
    const { onChanged } = renderSection();

    fireEvent.click(screen.getByRole('switch'));
    await screen.findByAltText('TOTP QR');
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '111111' } });
    fireEvent.click(screen.getByText('Подтвердить'));

    await screen.findByText('AAAA-1111');
    expect(screen.getByText('BBBB-2222')).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
    const enableCall = fetchMock.mock.calls[1];
    expect(enableCall[0]).toContain('/api/auth/2fa/enable');
    expect(JSON.parse((enableCall[1] as RequestInit).body as string)).toEqual({ code: '111111' });
  });

  it('неверный код при подтверждении показывает ошибку, recovery-коды не появляются', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { qrDataUrl: 'data:x', otpauthUrl: 'otpauth://x' }))
      .mockResolvedValueOnce(jsonResponse(400, { message: 'Неверный код' }));
    renderSection();

    fireEvent.click(screen.getByRole('switch'));
    await screen.findByAltText('TOTP QR');
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '000000' } });
    fireEvent.click(screen.getByText('Подтвердить'));

    await screen.findByText('Неверный код');
    expect(screen.queryByText(/Recovery-коды/)).toBeNull();
  });
});

describe('TwoFactorSection — отключение', () => {
  it('отключение верным кодом вызывает /api/auth/2fa/disable и onChanged', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { onChanged } = renderSection({ enabled: true, recoveryCodesLeft: 5 });

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '222222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    const disableCall = fetchMock.mock.calls[0];
    expect(disableCall[0]).toContain('/api/auth/2fa/disable');
    expect(JSON.parse((disableCall[1] as RequestInit).body as string)).toEqual({ code: '222222' });
  });

  it('ошибка при отключении показывает сообщение, 2FA остаётся включённой (не тишина)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'Неверный код' }));
    const { onChanged } = renderSection({ enabled: true, recoveryCodesLeft: 5 });

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));

    await screen.findByText('Неверный код');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('«Отмена» в режиме отключения возвращает к обычному виду без вызова api', () => {
    renderSection({ enabled: true, recoveryCodesLeft: 5 });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.queryByPlaceholderText('123456')).toBeNull();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('повторный клик по включённому переключателю в режиме отключения отменяет его', () => {
    renderSection({ enabled: true, recoveryCodesLeft: 5 });
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByPlaceholderText('123456')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.queryByPlaceholderText('123456')).toBeNull();
  });

  it('клик по переключателю во время настройки отменяет её', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { qrDataUrl: 'data:image/png;base64,AAA', otpauthUrl: 'otpauth://x' }));
    renderSection();
    fireEvent.click(screen.getByRole('switch'));
    await screen.findByAltText('TOTP QR');
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.queryByAltText('TOTP QR')).toBeNull();
  });
});

// Аудит 2026-10, «сырой текст на экранах аккаунта»: ответ клали на экран как
// есть — «ThrottlerException…», «Invalid code», «TypeError: Failed to fetch»,
// а лимит и авария выглядели как «Неверный код». Ответы — настоящие Response.
describe('TwoFactorSection — человеческий текст вместо сырого', () => {
  function submitDisable() {
    renderSection({ enabled: true, recoveryCodesLeft: 5 });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));
  }

  it('401 «Invalid code» (как отдаёт totp.service) — «Неверный код», без английского', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ statusCode: 401, message: 'Invalid code' }), { status: 401 }));
    submitDisable();
    await screen.findByText('Неверный код');
    expect(screen.queryByText(/Invalid/)).toBeNull();
  });

  it('429 голой строкой — текст про лимит, не «Неверный код» и не «ThrottlerException»', async () => {
    fetchMock.mockResolvedValue(new Response('"ThrottlerException: Too Many Requests"', { status: 429 }));
    submitDisable();
    await screen.findByText('Слишком много попыток подряд. Повторить можно чуть позже');
    expect(screen.queryByText(/Неверный код|Throttler/)).toBeNull();
  });

  it('обрыв сети при старте настройки — «Нет связи с сервером», не «TypeError: Failed to fetch»', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { container } = renderSection();
    fireEvent.click(screen.getByRole('switch'));
    await screen.findByText('Нет связи с сервером');
    expect(container.textContent).not.toMatch(/TypeError|Failed to fetch/);
  });
});
