// Мок discovery — тот же приём, что в caldav.service.spec.ts.
jest.mock('../../booking/caldav-discovery', () => ({
  listCalendars: jest.fn(),
}));

import { caldavProbe } from './probe-caldav';
import { calDavHealth } from '../../booking/caldav-health';
import { listCalendars } from '../../booking/caldav-discovery';

const mockedListCalendars = listCalendars as jest.Mock;
const ENV = { APPLE_ID: 'me@icloud.com', APPLE_APP_PASSWORD: 'pass' };

beforeEach(() => {
  calDavHealth.reset();
  mockedListCalendars.mockReset();
});

describe('caldavProbe', () => {
  it('не сконфигурирован (нет APPLE_ID/APPLE_APP_PASSWORD) — выключено, не авария', async () => {
    const res = await caldavProbe({}).run();
    expect(res).toEqual({ ok: true, detail: 'выключено' });
    expect(mockedListCalendars).not.toHaveBeenCalled();
  });

  it('явный APPLE_CALDAV_URL — автообнаружение пропускается', async () => {
    const res = await caldavProbe({
      ...ENV,
      APPLE_CALDAV_URL: 'https://p1.icloud.com/x/',
    }).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('APPLE_CALDAV_URL');
    expect(mockedListCalendars).not.toHaveBeenCalled();
  });

  it('обнаружение находит календари — ok, трекер остаётся закрытым', async () => {
    mockedListCalendars.mockResolvedValue([
      { url: 'https://p1.icloud.com/1/calendars/home/', name: 'Home' },
    ]);
    const res = await caldavProbe(ENV).run();
    expect(res).toEqual({ ok: true, detail: 'найдено календарей: 1' });
    expect(calDavHealth.snapshot().open).toBe(false);
  });

  // Регресс 2026-09-13/16: пустой список молчал до трекера здоровья.
  it('обнаружение находит 0 календарей — не ok, открывает аварию в caldav-health', async () => {
    mockedListCalendars.mockResolvedValue([]);
    const res = await caldavProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('не нашло ни одного календаря');
    expect(calDavHealth.snapshot()).toMatchObject({
      open: true,
      lastFailKind: 'empty',
    });
  });

  it('обнаружение падает с 403 — классифицируется как auth, открывает аварию', async () => {
    mockedListCalendars.mockRejectedValue(
      new Error('PROPFIND 403 https://caldav.icloud.com/ — forbidden'),
    );
    const res = await caldavProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(calDavHealth.snapshot()).toMatchObject({
      open: true,
      lastFailKind: 'auth',
    });
  });

  it('обнаружение падает по таймауту — классифицируется как timeout', async () => {
    mockedListCalendars.mockRejectedValue(
      new Error('The operation was aborted due to timeout'),
    );
    const res = await caldavProbe(ENV).run();
    expect(res.ok).toBe(false);
    expect(calDavHealth.snapshot().lastFailKind).toBe('timeout');
  });

  it('успех после открытой аварии закрывает её (side effect на общем трекере)', async () => {
    calDavHealth.noteFailure('auth', 'REPORT 403'); // открывает сразу
    mockedListCalendars.mockResolvedValue([
      { url: 'https://p1.icloud.com/1/calendars/home/', name: 'Home' },
    ]);
    await caldavProbe(ENV).run();
    expect(calDavHealth.snapshot().open).toBe(false);
  });
});
