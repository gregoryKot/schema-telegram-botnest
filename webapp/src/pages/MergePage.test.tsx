// @vitest-environment jsdom
// Компонентные тесты MergePage — контур, где данные реально сливаются между
// аккаунтами (CLAUDE.md: см. src/auth/merge.service.ts на бэкенде). Мокаем
// global fetch напрямую (компонент ходит через fetch, не через '../api') —
// образец: AccountPage.test.tsx / AuthCallback.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
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
// Сводка по токену (POST /api/auth/merge/preview) — отдельный мок, чтобы
// fetchMock по-прежнему видел только сам merge (индексы вызовов в тестах ниже).
let previewMock: ReturnType<typeof vi.fn>;
const PREVIEW = { provider: 'google', otherDisplay: null, summary: {}, twoFactorLost: false };

beforeEach(() => {
  fetchMock = vi.fn();
  previewMock = vi.fn(() => Promise.resolve(jsonResponse(200, PREVIEW)));
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    String(url).includes('/api/auth/merge/preview') ? previewMock(url, init) : fetchMock(url, init));
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

// S20 (аудит 2026-11): адрес собирает кто угодно, подписан только токен —
// имя и сводка приходят с сервера по токену (merge/preview), query не читается.
describe('MergePage — сводка с сервера по токену', () => {
  it('имя и счётчики — из ответа сервера; name и summary из адреса не попадают в DOM', async () => {
    previewMock.mockResolvedValue(jsonResponse(200, {
      provider: 'google', otherDisplay: 'user@gmail.com', summary: { Rating: 12, Note: 3 }, twoFactorLost: false,
    }));
    const fake = JSON.stringify({ Rating: 99, 'Позвоните 8-900': 1 });
    const { container } = renderAt(
      `/merge?token=abc&summary=${encodeURIComponent(fake)}&provider=vk&name=${encodeURIComponent('Служба безопасности банка')}`,
    );
    await screen.findByText('оценки потребностей');
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('15 записей')).toBeTruthy();
    expect(screen.getByText('Google').tagName).toBe('B');
    const text = container.textContent ?? '';
    expect(text).toContain('(user@gmail.com) уже существует');
    expect(text).not.toMatch(/Служба безопасности|8-900|99|ВКонтакте/);
  });

  it('запрос сводки: POST с токеном, Bearer и CSRF-заголовком', async () => {
    renderAt('/merge?token=abc');
    await waitFor(() => expect(previewMock).toHaveBeenCalled());
    const [url, init] = previewMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/merge/preview');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'abc' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect((init.headers as Record<string, string>)['x-requested-with']).toBe('webapp');
  });

  it('пока сводка грузится — силуэт, а не «нет данных» и не нули', async () => {
    previewMock.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');
    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/Нет данных|записей|0/);
  });

  it('пустой переносимый аккаунт — явное «нет данных», не 0/NaN', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Нет данных – объединение пройдёт без переноса.');
  });

  it('чужой токен (403) — нейтральный текст без имён и цифр', async () => {
    previewMock.mockResolvedValue(jsonResponse(403, { message: 'Forbidden' }));
    const { container } = renderAt('/merge?token=abc&name=Ann&provider=google');
    await screen.findByText(/Найден ещё один аккаунт\. Если объединить/);
    expect(container.textContent).not.toMatch(/Ann|Google|записей|Нет данных/);
  });

  it.each([
    ['vk', 'ВКонтакте'],
    ['telegram', 'Telegram'],
    ['max', 'MAX'],
  ])('провайдер сервера %s → «%s» из словаря, без технического id', async (id, name) => {
    previewMock.mockResolvedValue(jsonResponse(200, { ...PREVIEW, provider: id }));
    renderAt('/merge?token=abc');
    const bold = await screen.findByText(name);
    expect(bold.tagName).toBe('B');
    expect(screen.queryByText(id)).toBeNull();
  });

  it('неизвестный провайдер не выводится — «Другой аккаунт»', async () => {
    previewMock.mockResolvedValue(jsonResponse(200, { ...PREVIEW, provider: 'some-new-idp' }));
    renderAt('/merge?token=abc');
    await screen.findByText(/Другой аккаунт уже существует/);
    expect(screen.queryByText(/some-new-idp/)).toBeNull();
  });

  it('форма «вы» — «ваш текущий аккаунт»', async () => {
    const { container } = renderAt('/merge?token=abc', authValue(), 'vy');
    await screen.findByText('Нет данных – объединение пройдёт без переноса.');
    expect(container.textContent).toContain('переедет в ваш текущий аккаунт');
    expect(container.textContent).not.toContain('твой');
  });
});

// R3 (аудит 2026-11): записи с одним ключом в обоих аккаунтах объединяются, а не
// переезжают дублем; экран называет их число и не обещает «всё переедет».
describe('MergePage — записи, которые объединятся', () => {
  const withCombined = (combined: number) =>
    previewMock.mockResolvedValue(jsonResponse(200, { ...PREVIEW, summary: { Note: 4, GratitudeDiaryEntry: 2 }, combined }));

  it('combined > 0 — число и что станет с записями, без «всё переедет»', async () => {
    withCombined(3);
    const { container } = renderAt('/merge?token=abc');
    await screen.findByText(/3 записи совпадают с твоими по дню, схеме или режиму/);
    const text = container.textContent ?? '';
    expect(text).toContain('каждая такая пара объединится в одну');
    expect(text).toContain('записи из него переедут в твой текущий аккаунт');
    expect(text).not.toMatch(/всё, что в нём записано, переедет/);
  });

  it('форма «вы» — «с вашими», без «ты»-форм', async () => {
    withCombined(1);
    const { container } = renderAt('/merge?token=abc', authValue(), 'vy');
    await screen.findByText(/1 запись совпадает с вашими/);
    expect(container.textContent).toContain('переедут в ваш текущий аккаунт');
    expect(container.textContent).not.toMatch(/твой|твоими/);
  });

  it('combined = 0 или нет в ответе — абзаца нет, прежнее «всё переедет»', async () => {
    withCombined(0);
    const { container } = renderAt('/merge?token=abc');
    await screen.findByText('6 записей');
    expect(container.textContent).not.toMatch(/совпада|объединится в одну/);
    expect(container.textContent).toContain('всё, что в нём записано, переедет');
  });
});

describe('MergePage — потеря двухфакторной защиты', () => {
  const NOTE = /Двухфакторная защита второго аккаунта не переедет/;

  it('сервер говорит twoFactorLost — предупреждение есть', async () => {
    previewMock.mockResolvedValue(jsonResponse(200, { ...PREVIEW, twoFactorLost: true }));
    renderAt('/merge?token=abc');
    await screen.findByText(NOTE);
  });

  it('сервер говорит «не теряется» — ?twofa=1 из адреса не перебивает', async () => {
    renderAt('/merge?token=abc&twofa=1');
    await screen.findByText('Нет данных – объединение пройдёт без переноса.');
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('сводка не загрузилась — флаг из адреса остаётся запасным', async () => {
    previewMock.mockResolvedValue(jsonResponse(500, {}));
    renderAt('/merge?token=abc&twofa=1');
    await screen.findByText(NOTE);
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

// Аудит 2026-10, «сырой текст сервера на экранах входа»: экран показывал
// «Error: Merge failed», «ThrottlerException…» (POST /api/auth/merge — 3 в
// минуту, test/throttle-storage.e2e-spec.ts) и «TypeError: Failed to fetch».
// Ответы — настоящие Response.
describe('MergePage — ошибки человеческим текстом', () => {
  it('429 — русский текст сервера со сроком', async () => {
    const text = 'Слишком много попыток подряд. Повторить можно через минуту';
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ statusCode: 429, message: text }), { status: 429 })));
    const { container } = renderAt('/merge?token=secret-token');
    await confirmMerge();
    await screen.findByText(text);
    expect(container.textContent).not.toMatch(/Throttler|Error:/);
  });

  it('500 без текста (HTML прокси) — «сервер не ответил»', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('<html>502</html>', { status: 502 })));
    renderAt('/merge?token=secret-token');
    await confirmMerge();
    await screen.findByText('Сервер не ответил. Повторить можно чуть позже');
  });

  it('служебный английский сервера — запасной русский текст, не «Merge failed»', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('{"statusCode":401,"message":"Unauthorized"}', { status: 401 })));
    const { container } = renderAt('/merge?token=secret-token');
    await confirmMerge();
    await screen.findByText('Не получилось объединить аккаунты');
    expect(container.textContent).not.toMatch(/Unauthorized|Merge failed/);
  });

  it('обрыв сети — «Нет связи с сервером»', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const { container } = renderAt('/merge?token=secret-token');
    await confirmMerge();
    await screen.findByText('Нет связи с сервером');
    expect(container.textContent).not.toMatch(/TypeError/);
  });
});
