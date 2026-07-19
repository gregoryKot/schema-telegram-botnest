// Auto-discovery iCloud CalDAV-календаря по Apple ID (PROPFIND-цепочка).
// Сеть мокаем через global.fetch (как в robokassa.service.spec.ts); фокус —
// на путях фолбэка (когда что-то не нашлось) и на фильтрации служебных
// коллекций (inbox/outbox/notification), а не на самом PROPFIND-протоколе.
import { discoverCalendarUrl, listCalendars } from './caldav-discovery';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const PRINCIPAL_XML = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
  <d:response><d:propstat><d:prop>
    <d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>
  </d:prop></d:propstat></d:response></d:multistatus>`;

const HOME_XML = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response><d:propstat><d:prop>
    <c:calendar-home-set><d:href>/123/calendars/</d:href></c:calendar-home-set>
  </d:prop></d:propstat></d:response></d:multistatus>`;

function listXml(
  entries: { href: string; name: string; vevent: boolean }[],
): string {
  const responses = entries
    .map(
      (e) => `<d:response>
        <d:href>${e.href}</d:href>
        <d:propstat><d:prop>
          <d:displayname>${e.name}</d:displayname>
          ${e.vevent ? '<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>' : ''}
        </d:prop></d:propstat>
      </d:response>`,
    )
    .join('');
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${responses}</d:multistatus>`;
}

function mockSequence(
  ...responses: { status?: number; ok?: boolean; body: string }[]
) {
  let i = 0;
  global.fetch = jest.fn(() => {
    const r = responses[i++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: r.ok ?? true,
      status: r.status ?? 207,
      text: () => Promise.resolve(r.body),
    } as any);
  }) as any;
}

describe('listCalendars — счастливый путь (3 шага PROPFIND)', () => {
  it('возвращает только VEVENT-календари, исключая inbox/outbox/notification', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      {
        body: listXml([
          { href: '/123/calendars/home/', name: 'Home', vevent: true },
          { href: '/123/calendars/inbox/', name: 'Inbox', vevent: true },
          { href: '/123/calendars/tasks/', name: 'Tasks', vevent: false },
        ]),
      },
    );
    const cals = await listCalendars('Basic xyz');
    expect(cals).toHaveLength(1);
    expect(cals[0].name).toBe('Home');
    expect(cals[0].url).toContain('/123/calendars/home/');
  });

  it('href без протокола достраивается до абсолютного URL от origin', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      {
        body: listXml([
          { href: '/123/calendars/home/', name: 'Home', vevent: true },
        ]),
      },
    );
    const cals = await listCalendars('Basic xyz');
    expect(cals[0].url.startsWith('https://')).toBe(true);
  });
});

describe('listCalendars — отсутствие шагов discovery (фолбэк на ручной URL у вызывающего кода)', () => {
  it('нет current-user-principal в ответе — возвращает [] без дальнейших запросов', async () => {
    mockSequence({ body: '<d:multistatus xmlns:d="DAV:"></d:multistatus>' });
    const cals = await listCalendars('Basic xyz');
    expect(cals).toEqual([]);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1); // не дошли до шага 2
  });

  it('нет calendar-home-set — возвращает [] после шага 2', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: '<d:multistatus xmlns:d="DAV:"></d:multistatus>' },
    );
    const cals = await listCalendars('Basic xyz');
    expect(cals).toEqual([]);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('ни одного календаря с VEVENT в перечне — []', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      { body: listXml([{ href: '/x/', name: 'Reminders', vevent: false }]) },
    );
    expect(await listCalendars('Basic xyz')).toEqual([]);
  });
});

describe('listCalendars — сетевая ошибка PROPFIND отклоняет промис (обрабатывается вызывающей стороной)', () => {
  it('PROPFIND вернул не-207 и не ok — reject с описательной ошибкой', async () => {
    mockSequence({ status: 500, ok: false, body: 'server error' });
    await expect(listCalendars('Basic xyz')).rejects.toThrow(/PROPFIND 500/);
  });
});

describe('discoverCalendarUrl', () => {
  it('нет ни одного календаря — возвращает null', async () => {
    mockSequence({ body: '<d:multistatus xmlns:d="DAV:"></d:multistatus>' });
    expect(await discoverCalendarUrl('Basic xyz')).toBeNull();
  });

  it('preferredName совпадает с одним из календарей (регистронезависимо) — возвращает именно его', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      {
        body: listXml([
          { href: '/123/calendars/home/', name: 'Home', vevent: true },
          { href: '/123/calendars/work/', name: 'Work', vevent: true },
        ]),
      },
    );
    const url = await discoverCalendarUrl('Basic xyz', 'WORK');
    expect(url).toContain('/123/calendars/work/');
  });

  it('preferredName не найден среди календарей — возвращает первый попавшийся', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      {
        body: listXml([
          { href: '/123/calendars/home/', name: 'Home', vevent: true },
        ]),
      },
    );
    const url = await discoverCalendarUrl('Basic xyz', 'Nonexistent');
    expect(url).toContain('/123/calendars/home/');
  });

  it('preferredName не передан — возвращает первый календарь по умолчанию', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      {
        body: listXml([
          { href: '/123/calendars/home/', name: 'Home', vevent: true },
        ]),
      },
    );
    const url = await discoverCalendarUrl('Basic xyz');
    expect(url).toContain('/123/calendars/home/');
  });
});
