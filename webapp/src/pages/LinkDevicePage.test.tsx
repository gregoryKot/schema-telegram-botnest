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
// getSettings — LinkDeviceContent ставит свой AddressFormProvider (страница
// вне RequireAuth) и тут же грузит форму через него; 'vy' сохраняет
// существующие ассерты на «вы»-текст ниже без переписывания.
vi.mock('../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({ addressForm: 'vy' }),
  },
}));

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

// Галочка «я понимаю» — без неё «Разрешить доступ» недоступна (как в MergePage).
function confirmAck() {
  fireEvent.click(screen.getByRole('checkbox'));
}

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

    await waitFor(() => expect(screen.getByText(/Приложение в MAX/)).toBeTruthy());
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
    expect(screen.getByText(/нажмите «Это не я»/)).toBeTruthy();
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
    confirmAck();
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
    confirmAck();
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
    confirmAck();
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    expect(api.trackEvent).toHaveBeenCalledWith('account_link_confirmed', {
      host: 'max',
      merged: false,
    });
  });

  it('повтор из второй вкладки — экран «Готово», но событие успеха второй раз не уходит', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(
      jsonResponse(200, { merged: false, repeat: true }),
    );
    confirmAck();
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('подтверждение упало — событие успеха не уходит', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'Код истёк' }));
    confirmAck();
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
    confirmAck();
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() =>
      expect(screen.getByText('Не удалось объединить аккаунты')).toBeTruthy(),
    );
    expect(screen.queryByText('Готово')).toBeNull();
  });
});

// Аудит 2026-10, «сырой текст сервера на экранах входа»: сводка и подтверждение
// показывали «ThrottlerException…» (код человека — 5 в минуту, CODE_THROTTLE),
// а обрыв сети — «Failed to fetch». Ответы — настоящие Response.
describe('ошибки человеческим текстом', () => {
  it('контроль: сводка упёрлась в лимит — русский текст сервера проходит как есть', async () => {
    const text = 'Слишком много попыток подряд. Повторить можно через минуту';
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ statusCode: 429, message: text }), { status: 429 })));
    const { container } = renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText(text)).toBeTruthy());
    expect(container.textContent).not.toMatch(/Throttler/);
  });

  it('сводка: обрыв сети — «Нет связи с сервером»', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const { container } = renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Нет связи с сервером')).toBeTruthy());
    expect(container.textContent).not.toMatch(/Failed to fetch/);
  });

  it('подтверждение: 502 HTML прокси — «сервер не ответил», не «Не получилось»', async () => {
    renderAt('/link?code=ABCD2345');
    await waitFor(() => expect(screen.getByText('Разрешить доступ')).toBeTruthy());

    fetchMock.mockImplementation(() => Promise.resolve(new Response('<html>502</html>', { status: 502 })));
    confirmAck();
    fireEvent.click(screen.getByText('Разрешить доступ'));

    await waitFor(() =>
      expect(screen.getByText('Сервер не ответил. Повторить можно чуть позже')).toBeTruthy());
    expect(screen.queryByText('Готово')).toBeNull();
  });
});

// BACKLOG «/link»: эффект тот же, что у MergePage (второй аккаунт вливается и
// удаляется), — значит и подтверждение то же: галочка и «Это не я».
describe('галочка «я понимаю»', () => {
  it('без галочки подтвердить нельзя; с ней — можно', async () => {
    renderAt('/link?code=ABCD2345');
    const btn = await screen.findByRole('button', { name: 'Разрешить доступ' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    confirmAck();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('называет реальный эффект: доступ, необратимый перенос, удаление прежнего аккаунта', async () => {
    renderAt('/link?code=ABCD2345');
    await screen.findByRole('checkbox');
    expect(screen.getByText(
      'Я понимаю, что приложение в MAX получит полный доступ к этому аккаунту, его данные необратимо переедут сюда, а прежний аккаунт приложения будет удалён.',
    )).toBeTruthy();
  });

  it('тот же аккаунт — галочка только про доступ, про удаление не врёт', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ...PREVIEW, sameAccount: true, summary: {} }),
    );
    renderAt('/link?code=ABCD2345');
    await screen.findByRole('checkbox');
    expect(screen.getByText('Я понимаю, что приложение в MAX получит полный доступ к этому аккаунту.')).toBeTruthy();
    expect(screen.queryByText(/будет удалён/)).toBeNull();
  });
});

describe('«Это не я»', () => {
  it('гасит билет, не подтверждая, и говорит, что доступ никто не получил', async () => {
    renderAt('/link?code=ABCD2345');
    await screen.findByText('Это не я');

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    fireEvent.click(screen.getByText('Это не я'));

    await waitFor(() => expect(screen.getByText('Доступ никто не получил')).toBeTruthy());
    expect(screen.getByText(/Код не подтверждён: приложение в MAX не получило доступ/)).toBeTruthy();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith('/deny-login'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/approve'))).toBe(false);
    const denyCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/deny-login'))!;
    expect(JSON.parse(String((denyCall[1] as RequestInit).body))).toEqual({ code: 'ABCD2345' });
    // Отказ — сработавшая защита, а не провал переноса: событий нет.
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('галочка для отказа не нужна', async () => {
    renderAt('/link?code=ABCD2345');
    const deny = await screen.findByRole('button', { name: 'Это не я' });
    expect((deny as HTMLButtonElement).disabled).toBe(false);
  });

  it('запрос отказа не долетел — исход тот же: код никто не подтвердил', async () => {
    renderAt('/link?code=ABCD2345');
    await screen.findByText('Это не я');

    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    fireEvent.click(screen.getByText('Это не я'));

    await waitFor(() => expect(screen.getByText('Доступ никто не получил')).toBeTruthy());
  });

  it('после отказа — дорога в аккаунт', async () => {
    renderAt('/link?code=ABCD2345');
    await screen.findByText('Это не я');
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    fireEvent.click(screen.getByText('Это не я'));

    fireEvent.click(await screen.findByText('В аккаунт'));
    expect(screen.getByText('АККАУНТ')).toBeTruthy();
  });
});
