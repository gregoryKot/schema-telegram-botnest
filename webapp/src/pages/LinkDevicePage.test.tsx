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

vi.mock('../auth/authContext', () => ({ useAuth: vi.fn() }));

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
    await waitFor(() => expect(screen.getByText('Да, это я')).toBeTruthy());

    fetchMock.mockResolvedValue(jsonResponse(200, { merged: true }));
    fireEvent.click(screen.getByText('Да, это я'));

    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    const approveCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith('/approve'),
    )!;
    expect((approveCall[1] as RequestInit).credentials).toBe('include');
    expect(
      (approveCall[1] as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ 'x-requested-with': 'webapp' });
  });

  it('подтверждение не прошло — сообщение видно, экран «готово» не показывается', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Да, это я')).toBeTruthy());

    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: 'Не удалось объединить аккаунты' }),
    );
    fireEvent.click(screen.getByText('Да, это я'));

    await waitFor(() =>
      expect(screen.getByText('Не удалось объединить аккаунты')).toBeTruthy(),
    );
    expect(screen.queryByText('Готово')).toBeNull();
  });
});
