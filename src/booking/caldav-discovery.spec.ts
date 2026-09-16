// Auto-discovery iCloud CalDAV-календаря по Apple ID (PROPFIND-цепочка).
// Сеть мокаем через global.fetch (как в robokassa.service.spec.ts); фокус —
// на путях фолбэка (когда что-то не нашлось) и на фильтрации служебных
// коллекций (inbox/outbox/notification), а не на самом PROPFIND-протоколе.
//
// PRINCIPAL_XML/HOME_XML/RECORDED_CALENDARS_XML грузятся из
// test/fixtures/recorded/ (не хардкожены инлайн) — правило №14 CLAUDE.md:
// PR #491/#494 дважды ловили баг ровно потому, что фикстура была авторской
// выдумкой, а не тем, что реально шлёт iCloud. См.
// test/fixtures/recorded/README.md и scripts/check-recorded-fixtures.mjs.
import { discoverCalendarUrl, listCalendars } from './caldav-discovery';
import { loadRecordedFixture } from '../test-support/recorded-fixture';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const PRINCIPAL_XML = loadRecordedFixture('icloud-propfind-principal.xml');
const HOME_XML = loadRecordedFixture('icloud-propfind-home.xml');
// Корень (без <calendar/> в resourcetype) первым + один календарь тегом
// `<C:calendar xmlns:C="…"/>` С АТРИБУТАМИ — ровно та форма, на которой
// сломались PR #491 (корень принят за календарь) и PR #494 (регэксп не
// матчил атрибуты).
const RECORDED_CALENDARS_XML = loadRecordedFixture(
  'icloud-propfind-calendars.xml',
);

// Тот же корневой блок, что в RECORDED_CALENDARS_XML (см. выше) — держим
// его отдельно здесь только чтобы комбинировать с ДОПОЛНИТЕЛЬНЫМИ синтетическими
// записями ниже (inbox/tasks — комбинации, которых в одной записанной
// фикстуре не бывает, но которые обязана отсеивать та же фильтрация).
// Канонический «как шлёт настоящий iCloud» случай — RECORDED_CALENDARS_XML.
const ROOT_RESPONSE = `<d:response>
  <d:href>/123/calendars/</d:href>
  <d:propstat><d:prop>
    <d:resourcetype><d:collection/></d:resourcetype>
    <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
  </d:prop></d:propstat>
</d:response>`;

// Комбинаторный билдер для синтетических вариантов фильтрации (несколько
// записей сразу, разные vevent-флаги) — форма тега calendar с атрибутами
// (та же, что в RECORDED_CALENDARS_XML) сохранена нарочно, чтобы регресс
// PR #494 не проскочил ни в одном из этих сценариев тоже.
function listXml(
  entries: { href: string; name: string; vevent: boolean }[],
): string {
  const responses = entries
    .map(
      (e) => `<d:response>
        <d:href>${e.href}</d:href>
        <d:propstat><d:prop>
          <d:displayname>${e.name}</d:displayname>
          <d:resourcetype><d:collection/><c:calendar xmlns:c="urn:ietf:params:xml:ns:caldav"/></d:resourcetype>
          ${e.vevent ? '<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>' : ''}
        </d:prop></d:propstat>
      </d:response>`,
    )
    .join('');
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${ROOT_RESPONSE}${responses}</d:multistatus>`;
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
  it('возвращает только VEVENT-календари, исключая корень, inbox/outbox/notification', async () => {
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
    // Порядок ответов PROPFIND прежний (корень первым) — важна не сортировка,
    // а то, что корень отфильтрован, а Home дошёл до результата.
    expect(cals.map((c) => c.url)).not.toContain(
      'https://caldav.icloud.com/123/calendars/',
    );
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

describe('listCalendars — фильтр корня (регресс инцидента 2026-09-13/2026-09-16)', () => {
  it('корень + календарь тегом с атрибутами, как в РЕАЛЬНОМ ответе iCloud (test/fixtures/recorded) — корень отфильтрован, Home найден', async () => {
    mockSequence(
      { body: PRINCIPAL_XML },
      { body: HOME_XML },
      { body: RECORDED_CALENDARS_XML },
    );
    const cals = await listCalendars('Basic xyz');
    expect(cals).toHaveLength(1);
    expect(cals[0].name).toBe('Home');
    expect(cals.map((c) => c.url)).not.toContain(
      'https://caldav.icloud.com/123/calendars/',
    );
  });

  // Контроль: и НЕ-корневой блок с VEVENT, но без <c:calendar/> в
  // resourcetype (например, недо-настроенная общая коллекция) обязан
  // исключаться — фильтр смотрит на resourcetype, а не просто на href !== homeUrl.
  it('не-корневой блок с VEVENT, но без <c:calendar/> в resourcetype — тоже исключён', async () => {
    const body = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
      ${ROOT_RESPONSE}
      <d:response>
        <d:href>/123/calendars/shared/</d:href>
        <d:propstat><d:prop>
          <d:displayname>Shared</d:displayname>
          <d:resourcetype><d:collection/></d:resourcetype>
          <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
        </d:prop></d:propstat>
      </d:response>
      <d:response>
        <d:href>/123/calendars/home/</d:href>
        <d:propstat><d:prop>
          <d:displayname>Home</d:displayname>
          <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
          <c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>
        </d:prop></d:propstat>
      </d:response>
    </d:multistatus>`;
    mockSequence({ body: PRINCIPAL_XML }, { body: HOME_XML }, { body });
    const cals = await listCalendars('Basic xyz');
    expect(cals).toHaveLength(1);
    expect(cals[0].name).toBe('Home');
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
