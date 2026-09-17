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
  it('показывает объяснение и кнопку «Включить 2FA», без recovery-кодов', () => {
    renderSection();
    expect(screen.getByText(/Дополнительный код из приложения/)).toBeTruthy();
    expect(screen.getByText('Включить 2FA')).toBeTruthy();
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

    fireEvent.click(screen.getByText('Включить 2FA'));

    await screen.findByAltText('TOTP QR');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/2fa/setup');
  });

  it('ошибка при старте настройки показывает сообщение, QR не появляется', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Сервис недоступен' }));
    renderSection();

    fireEvent.click(screen.getByText('Включить 2FA'));

    await screen.findByText('Сервис недоступен');
    expect(screen.queryByAltText('TOTP QR')).toBeNull();
  });

  it('подтверждение верным кодом вызывает /api/auth/2fa/enable и показывает recovery-коды', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { qrDataUrl: 'data:x', otpauthUrl: 'otpauth://x' }))
      .mockResolvedValueOnce(jsonResponse(200, { recoveryCodes: ['AAAA-1111', 'BBBB-2222'] }));
    const { onChanged } = renderSection();

    fireEvent.click(screen.getByText('Включить 2FA'));
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

    fireEvent.click(screen.getByText('Включить 2FA'));
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

    fireEvent.click(screen.getByText('Отключить 2FA'));
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

    fireEvent.click(screen.getByText('Отключить 2FA'));
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));

    await screen.findByText('Неверный код');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('«Отмена» в режиме отключения возвращает к обычному виду без вызова api', () => {
    renderSection({ enabled: true, recoveryCodesLeft: 5 });
    fireEvent.click(screen.getByText('Отключить 2FA'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.getByText('Отключить 2FA')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
