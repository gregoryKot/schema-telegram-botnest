// @vitest-environment jsdom
// Экран подтверждения привязки из мессенджера.
//
// Он же — защита флоу от уговоров: коды-привязки исторически ломают социальной
// инженерией («введите код для проверки безопасности»). Поэтому тесты держат
// главное — до нажатия человеку сказано, ЧЕЙ аккаунт и ЧТО именно переедет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LinkDevicePage } from './LinkDevicePage';
import { useAuth } from '../auth/authContext';
import { api } from '../api';

vi.mock('../auth/authContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

const mockedAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function setAuth(over: Record<string, unknown> = {}) {
  mockedAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    ...over,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const PREVIEW = {
  provider: 'max',
  displayName: 'Гриша',
  sameAccount: false,
  summary: { Rating: 12, UserLetter: 2 },
};

let fetchMock: ReturnType<typeof vi.fn>;

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/link" element={<LinkDevicePage />} />
        <Route path="/login" element={<div>ЭКРАН ВХОДА</div>} />
        <Route path="/account" element={<div>АККАУНТ</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, PREVIEW));
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
  setAuth();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('вход требуется', () => {
  it('не залогинен — уводит на вход и ЗАПОМИНАЕТ код, чтобы не начинать заново', () => {
    setAuth({ isAuthenticated: false });
    renderAt('/link?code=ABCD2345');

    expect(screen.getByText('ЭКРАН ВХОДА')).toBeTruthy();
    expect(sessionStorage.getItem('auth_return_to')).toBe('/link?code=ABCD2345');
  });

  it('кода в адресе нет — идти некуда, уводит в аккаунт', () => {
    renderAt('/link');
    expect(screen.getByText('АККАУНТ')).toBeTruthy();
  });
});

describe('что показано до подтверждения', () => {
  it('называет мессенджер, имя и перечисляет переезжающие данные', async () => {
    renderAt('/link?code=ABCD2345');

    await waitFor(() => expect(screen.getByText(/MAX/)).toBeTruthy());
    expect(screen.getByText(/Гриша/)).toBeTruthy();
    expect(screen.getByText('оценки потребностей')).toBeTruthy();
    expect(screen.getByText('письма себе')).toBeTruthy();
  });

  it('ведёт с направления доступа и предупреждает о чужом коде (O1)', async () => {
    renderAt('/link?code=ABCD2345');

    // Главное — не «импорт данных ко мне», а «приложение получит доступ к
    // МОЕМУ аккаунту». Текст обязан это сказать прямо, до кнопки.
    await waitFor(() =>
      expect(screen.getByText(/войти в этот аккаунт/)).toBeTruthy(),
    );
    expect(
      screen.getByText(/менять и удалять все ваши данные/),
    ).toBeTruthy();
    // Анти-фишинг: код, пришедший со стороны, подтверждать нельзя.
    expect(screen.getByText(/закройте эту страницу/)).toBeTruthy();
  });

  it('тот же аккаунт — про перенос не врёт', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ...PREVIEW, sameAccount: true, summary: {} }),
    );
    renderAt('/link?code=ABCD2345');

    await waitFor(() =>
      expect(screen.getByText(/переносить нечего/)).toBeTruthy(),
    );
  });

  it('код протух — показывает причину, а не пустой экран', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: 'Код не найден или истёк' }),
    );
    renderAt('/link?code=ABCD2345');

    await waitFor(() =>
      expect(screen.getByText('Код не найден или истёк')).toBeTruthy(),
    );
  });
});

describe('подтверждение', () => {
  it('шлёт approve с CSRF-заголовком и говорит вернуться в приложение', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(jsonResponse(200, { merged: true }));
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    const approveCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith('/approve'),
    )!;
    expect((approveCall[1] as RequestInit).credentials).toBe('include');
    expect(
      (approveCall[1] as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ 'x-requested-with': 'webapp' });
  });

  // ── Аналитика (правило №8) ────────────────────────────────────────────────
  it('успех считает ИМЕННО этот экран — мини-апп в этот момент ещё ждёт', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(jsonResponse(200, { merged: true }));
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    expect(api.trackEvent).toHaveBeenCalledWith('account_link_confirmed', {
      host: 'max',
      merged: true,
    });
  });

  it('подтвердили под тем же аккаунтом — merged=false, успех не приписывается переносу', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(jsonResponse(200, { merged: false }));
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    expect(api.trackEvent).toHaveBeenCalledWith('account_link_confirmed', {
      host: 'max',
      merged: false,
    });
  });

  it('подтверждение упало — событие успеха не уходит', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'Код истёк' }));
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() => expect(screen.getByText('Код истёк')).toBeTruthy());
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('подтверждение не прошло — сообщение видно, экран «готово» не показывается', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: 'Не удалось объединить аккаунты' }),
    );
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() =>
      expect(screen.getByText('Не удалось объединить аккаунты')).toBeTruthy(),
    );
    expect(screen.queryByText('Готово')).toBeNull();
  });
});
