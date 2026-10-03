// @vitest-environment jsdom
// Компонентные тесты MergePage — контур, где данные реально сливаются между
// аккаунтами (CLAUDE.md: см. src/auth/merge.service.ts на бэкенде). Мокаем
// global fetch напрямую (компонент ходит через fetch, не через '../api') —
// образец: AccountPage.test.tsx / AuthCallback.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { AddressFormContext } from '../utils/addressForm';
import { MergePage } from './MergePage';

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

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    accessToken: 'tok123',
    isLoading: false,
    isAuthenticated: true,
    setAccessToken: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    ...overrides,
  };
}

function renderAt(
  path: string,
  auth: AuthState = authValue(),
  form: 'ty' | 'vy' = 'ty',
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route path="/merge" element={<MergePage />} />
            <Route path="/account" element={<div>account-page</div>} />
          </Routes>
        </AuthContext.Provider>
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

async function confirmMerge() {
  await screen.findByText('Объединить аккаунты?');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));
}

describe('MergePage — без токена', () => {
  it('без ?token в URL сразу уходит на /account', async () => {
    renderAt('/merge');
    await screen.findByText('account-page');
  });
});

describe('MergePage — сводка переносимых данных', () => {
  it('показывает реальные счётчики из ?summary, а не выдуманные', async () => {
    const summary = JSON.stringify({ Rating: 12, Note: 3 });
    renderAt(
      `/merge?token=abc&summary=${encodeURIComponent(summary)}&provider=Google&name=user%40gmail.com`,
    );

    await screen.findByText('оценки потребностей');
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('заметки')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('15 записей')).toBeTruthy();
  });

  it('на пустом переносимом аккаунте (summary={}) — явное "нет данных", не 0/NaN', async () => {
    renderAt('/merge?token=abc');

    await screen.findByText('Нет данных – объединение пройдёт без переноса.');
  });
});

describe('MergePage — потеря двухфакторной защиты', () => {
  it('с ?twofa=1 показывает предупреждение о том, что 2FA не переедет', async () => {
    renderAt('/merge?token=abc&twofa=1');
    await screen.findByText('Объединить аккаунты?');

    expect(
      screen.getByText(/Двухфакторная защита второго аккаунта не переедет/),
    ).toBeTruthy();
  });

  it('без ?twofa в URL предупреждение не рендерится', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');

    expect(
      screen.queryByText(/Двухфакторная защита второго аккаунта не переедет/),
    ).toBeNull();
  });
});

describe('MergePage — подтверждение обязательно', () => {
  it('кнопка «Объединить» задизейблена, пока чекбокс не отмечен', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');

    expect(
      (screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('после отметки чекбокса кнопка активна', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');
    fireEvent.click(screen.getByRole('checkbox'));

    expect(
      (screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe('MergePage — успешное объединение', () => {
  it('вызывает POST /api/auth/merge с токеном, обновляет accessToken и уходит на /account', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { accessToken: 'new-tok', expiresIn: 900 }),
    );
    const setAccessToken = vi.fn();
    renderAt('/merge?token=secret-token', authValue({ setAccessToken }));
    await screen.findByText('Объединить аккаунты?');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));

    await screen.findByText('account-page');
    expect(setAccessToken).toHaveBeenCalledWith('new-tok', 900);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/merge');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      token: 'secret-token',
    });
  });
});

describe('MergePage — ошибка объединения', () => {
  it('ошибка API показывает причину, не переходит на /account, чекбокс/кнопка остаются', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { message: 'Токен истёк, запроси объединение заново' }),
    );
    renderAt('/merge?token=secret-token');
    await screen.findByText('Объединить аккаунты?');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));

    await screen.findByText(/Токен истёк, запроси объединение заново/);
    expect(screen.queryByText('account-page')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe('MergePage — отмена', () => {
  it('«Отмена» уходит на /account без вызова api', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await screen.findByText('account-page');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// A2 (аудит 2026-10): сервер больше не принимает merge-токен от анонима —
// доказательство «это тот аккаунт» едет refresh-кукой (и Bearer, если есть).
describe('MergePage — доказательство личности (A2)', () => {
  it('запрос идёт с credentials:include (refresh-кука) и Bearer, когда токен есть', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'n', expiresIn: 1 }));
    renderAt('/merge?token=abc', authValue({ accessToken: 'tok123' }));
    await confirmMerge();
    await screen.findByText('account-page');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
  });

  it('без accessToken в памяти (после OAuth-редиректа) Authorization не шлётся, кука остаётся', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'n', expiresIn: 1 }));
    renderAt('/merge?token=abc', authValue({ accessToken: null }));
    await confirmMerge();
    await screen.findByText('account-page');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization');
  });
});

// A4: у поглощаемого аккаунта включён TOTP — сервер просит его код (403).
describe('MergePage — второй фактор второго аккаунта (A4)', () => {
  const need = () => jsonResponse(403, { message: 'Нужен код', reason: 'source_totp_required' });

  it('поле кода не показывается, пока сервер его не потребовал', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');
    expect(screen.queryByLabelText('Код второго аккаунта')).toBeNull();
  });

  it('403 source_totp_required → появляется поле кода, ошибкой не считается, на /account не уходим', async () => {
    fetchMock.mockResolvedValueOnce(need());
    renderAt('/merge?token=abc');
    await confirmMerge();
    await screen.findByLabelText('Код второго аккаунта');
    expect(screen.queryByText('account-page')).toBeNull();
    expect(screen.queryByText(/Нужен код/)).toBeNull();
    // Пока код не введён (< 6 знаков), отправить нельзя.
    expect((screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ввод кода → повторный запрос с code, успех ведёт на /account', async () => {
    fetchMock
      .mockResolvedValueOnce(need())
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'n', expiresIn: 900 }));
    renderAt('/merge?token=abc');
    await confirmMerge();
    fireEvent.change(await screen.findByLabelText('Код второго аккаунта'), { target: { value: ' 123456 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));
    await screen.findByText('account-page');
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      token: 'abc',
      code: '123456',
    });
  });

  it('неверный код → «Код не подошёл», поле остаётся, на /account не уходим', async () => {
    fetchMock.mockResolvedValue(need());
    renderAt('/merge?token=abc');
    await confirmMerge();
    fireEvent.change(await screen.findByLabelText('Код второго аккаунта'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));
    await screen.findByText(/Код не подошёл\. Проверь его/);
    expect(screen.getByLabelText('Код второго аккаунта')).toBeTruthy();
    expect(screen.queryByText('account-page')).toBeNull();
  });

  it('форма «вы»: подсказка и ошибка без «ты»-форм', async () => {
    fetchMock.mockResolvedValue(need());
    renderAt('/merge?token=abc', authValue(), 'vy');
    await confirmMerge();
    await screen.findByText(/Чтобы подтвердить, что он ваш, введите код/);
    fireEvent.change(screen.getByLabelText('Код второго аккаунта'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));
    await screen.findByText(/Проверьте его и попробуйте ещё раз/);
    expect(screen.queryByText(/введи код|Проверь его/)).toBeNull();
  });

  it('403 с другой причиной остаётся обычной ошибкой, поле кода не появляется', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { message: 'Запрещено' }));
    renderAt('/merge?token=abc');
    await confirmMerge();
    await screen.findByText(/Запрещено/);
    expect(screen.queryByLabelText('Код второго аккаунта')).toBeNull();
  });
});
