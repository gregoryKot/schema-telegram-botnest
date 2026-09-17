// @vitest-environment jsdom
// Секция «данные из другого аккаунта» в настройках мини-аппа.
//
// Ограничение «только MAX» снято осознанно (правило №15: старый кейс
// it.each(['telegram','web']) фиксировал именно его и заменён честным
// ожиданием). Правило показа теперь одно на оба фронтенда —
// missingLinkTarget: в MAX своего входа для сайтов нет, поэтому карточка
// появляется сама; в Telegram обычный вход на сайте у человека есть, и
// карточка раскрывается только по явному жесту; если сайт уже привязан —
// собирать нечего, и секции нет вовсе.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import type { AddressForm } from '../../utils/addressForm';
import { LinkAccountSection } from './LinkAccountSection';
import { api } from '../../api';
import { authedFetch } from '../../apiClient';
import { adoptSession } from '../../session';

const host = { id: 'max', openLink: vi.fn(), insets: () => ({}) };

vi.mock('../../../../shared/src/host', () => ({ getHost: () => host }));
vi.mock('../../api', () => ({
  api: { getAuthProviders: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
vi.mock('../../apiClient', () => ({ authedFetch: vi.fn() }));
vi.mock('../../session', () => ({ adoptSession: vi.fn() }));

const TICKET = {
  deviceCode: 'd'.repeat(64),
  userCode: 'ABCD2345',
  expiresIn: 300,
  interval: 3,
};

const mocked = {
  providers: api.getAuthProviders as unknown as ReturnType<typeof vi.fn>,
  track: api.trackEvent as unknown as ReturnType<typeof vi.fn>,
  authed: authedFetch as unknown as ReturnType<typeof vi.fn>,
};

/** Рендер с формой обращения — тексты карточки разведены ты/вы. */
function show(form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      <LinkAccountSection />
    </AddressFormContext.Provider>,
  );
}

/**
 * Пролог тестов с опросом: билет выдан, сервер отвечает `pollResponse`,
 * карточка раскрыта и один круг опроса прошёл. Вынесено, потому что два теста
 * повторяли его дословно — jscpd считает такое дублем, и справедливо.
 */
async function pollOnce(pollResponse: unknown, betweenReads?: () => void) {
  mocked.authed.mockResolvedValue({
    ok: true,
    json: async () => ({ ...TICKET, interval: 1 }),
  });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => pollResponse,
  });

  const rendered = show();
  await act(async () => {});
  betweenReads?.();
  fireEvent.click(screen.getByText('У меня уже есть аккаунт'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1200);
  });
  return rendered;
}

/** Даём отработать промису /api/auth/me — до него состояние «не знаем». */
async function loaded(form: AddressForm = 'ty') {
  const r = show(form);
  await act(async () => {});
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  host.id = 'max';
  mocked.providers.mockResolvedValue(['max']);
  mocked.authed.mockResolvedValue({ ok: true, json: async () => TICKET });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'pending' }),
  });
});

afterEach(() => cleanup());

describe('кому показывается', () => {
  it('в MAX — сама: своего входа для сайтов у площадки нет', async () => {
    await loaded();
    expect(screen.getByText('У меня уже есть аккаунт')).toBeTruthy();
  });

  it('в MAX, пока ответ не пришёл, — силуэт карточки, а не пустота', () => {
    const { container } = show();
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(screen.queryByText('У меня уже есть аккаунт')).toBeNull();
  });

  it('в Telegram — сама не появляется, вместо неё строка-вопрос', async () => {
    host.id = 'telegram';
    mocked.providers.mockResolvedValue(['telegram']);
    await loaded();

    expect(screen.getByText('У меня уже есть аккаунт на сайте')).toBeTruthy();
    expect(screen.queryByText('У меня уже есть аккаунт')).toBeNull();
  });

  it('в Telegram раскрывается по жесту — тап по строке показывает карточку', async () => {
    host.id = 'telegram';
    mocked.providers.mockResolvedValue(['telegram']);
    await loaded();

    fireEvent.click(screen.getByText('У меня уже есть аккаунт на сайте'));
    expect(screen.getByText('У меня уже есть аккаунт')).toBeTruthy();
  });

  it('сайт уже привязан — секции нет вовсе, ни строки, ни карточки', async () => {
    host.id = 'telegram';
    mocked.providers.mockResolvedValue(['telegram', 'google']);
    const { container } = await loaded();
    expect(container.textContent).toBe('');
  });

  it('ответ не пришёл (сбой чтения) — тоже ничего: выдуманных состояний нет', async () => {
    mocked.providers.mockRejectedValue(new Error('API error: 500'));
    const { container } = await loaded();
    expect(container.textContent).toBe('');
  });
});

describe('обе формы обращения', () => {
  it('«ты» — карточка говорит на «ты»', async () => {
    const { container } = await loaded('ty');
    expect(screen.getByText(/дневник есть у тебя на сайте/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/у вас на сайте/);
  });

  it('«вы» — нигде не проскакивает «ты»', async () => {
    const { container } = await loaded('vy');
    expect(screen.getByText(/дневник есть у вас на сайте/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\bтеб[ея]\b|\bты\b/);
  });
});

describe('что происходит по нажатию', () => {
  it('уводит в браузер и показывает код с адресом — на случай, если не открылось', async () => {
    await loaded();
    await act(async () => {
      fireEvent.click(screen.getByText('У меня уже есть аккаунт'));
    });

    expect(host.openLink).toHaveBeenCalledWith(
      expect.stringContaining('/link?code=ABCD2345'),
    );
    expect(screen.getByText('ABCD-2345')).toBeTruthy();
    expect(screen.getByText(/\/link\?code=ABCD2345/)).toBeTruthy();
  });

  it('билет просят с намерением «привязать» и площадкой-источником', async () => {
    await loaded();
    await act(async () => {
      fireEvent.click(screen.getByText('У меня уже есть аккаунт'));
    });

    const [path, init] = mocked.authed.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(path).toBe('/api/auth/ticket/start');
    expect(JSON.parse(init.body)).toMatchObject({
      intent: 'link',
      provider: 'max',
      hostId: 'max',
    });
  });

  // ── Аналитика (правило №8): путь уходит во внешний браузер, и без события
  // «начал» отвал посередине неотличим от «даже не пробовал». ───────────────
  it('шлёт «начал перенос» сразу, ещё до ухода в браузер', async () => {
    await loaded();
    fireEvent.click(screen.getByText('У меня уже есть аккаунт'));

    expect(mocked.track).toHaveBeenCalledWith('account_link_started', {
      host: 'max',
    });
    await act(async () => {});
  });

  it('успех НЕ считается здесь — его считает браузер, иначе двойной счёт', async () => {
    await loaded();
    await act(async () => {
      fireEvent.click(screen.getByText('У меня уже есть аккаунт'));
    });

    const names = mocked.track.mock.calls.map((c) => c[0] as string);
    expect(names).not.toContain('account_link_confirmed');
  });

  it('сервер не ответил — причина error, а не текст ошибки (meta не шифруется)', async () => {
    mocked.authed.mockRejectedValue(
      new Error('API error: 500 at userId 12345'),
    );
    await loaded();
    await act(async () => {
      fireEvent.click(screen.getByText('У меня уже есть аккаунт'));
    });

    expect(mocked.track).toHaveBeenCalledWith('account_link_failed', {
      host: 'max',
      reason: 'error',
    });
    expect(JSON.stringify(mocked.track.mock.calls)).not.toContain('12345');
  });

  it('сервер не ответил — предлагает начать заново, а не оставляет в тупике', async () => {
    mocked.authed.mockRejectedValue(new Error('API error: 500'));
    await loaded();
    await act(async () => {
      fireEvent.click(screen.getByText('У меня уже есть аккаунт'));
    });

    fireEvent.click(screen.getByText('Начать заново'));
    expect(screen.getByText('У меня уже есть аккаунт')).toBeTruthy();
  });

  it('код протух — событие «не вышло» с причиной expired', async () => {
    vi.useFakeTimers();
    try {
      await pollOnce({ status: 'expired' });

      expect(mocked.track).toHaveBeenCalledWith('account_link_failed', {
        host: 'max',
        reason: 'expired',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // Отдельной строки «готово» у карточки нет: успех виден тем, что она
  // пропадает. Значит проверять надо связку «сессия принята → способы входа
  // перечитаны → карточки нет», а не только факт записи сессии.
  it('привязка удалась — сессия принята и карточка исчезает', async () => {
    vi.useFakeTimers();
    try {
      const { container } = await pollOnce(
        { status: 'linked', accessToken: 'a'.repeat(20), expiresIn: 900 },
        // Второе чтение — сайт уже привязан, собирать больше нечего.
        () => mocked.providers.mockResolvedValue(['max', 'google']),
      );
      await act(async () => {});

      expect(adoptSession).toHaveBeenCalledWith('a'.repeat(20), 900);
      expect(container.textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
