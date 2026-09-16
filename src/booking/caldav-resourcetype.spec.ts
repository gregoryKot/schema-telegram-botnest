// Регресс 2026-09-16 (PR #491): старый регэксп `/<[^>:]*:?calendar\s*\/?>/i`
// не матчил тег calendar С АТРИБУТАМИ — реальный iCloud отдаёт именно такую
// форму, фильтр пропускал ВСЕ календари, занятость всегда была «0» без
// единой ошибки. Табличный тест закрывает класс форм тега, а не одну строку.
import { isCalendarResource, classifyResponse } from './caldav-resourcetype';

describe('isCalendarResource', () => {
  const cases: [string, string, boolean][] = [
    ['<C:calendar/>', 'префикс, без атрибутов', true],
    ['<calendar/>', 'без префикса, без атрибутов', true],
    [
      '<C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/>',
      'префикс + атрибуты (реальный iCloud)',
      true,
    ],
    ['<cs:calendar />', 'префикс, пробел перед />', true],
    ['<C:calendar></C:calendar>', 'открывающий/закрывающий тег', true],
    ['<C:calendar-proxy-read/>', 'proxy-read — НЕ calendar', false],
    ['<C:calendar-proxy-write/>', 'proxy-write — НЕ calendar', false],
    ['<collection/>', 'просто коллекция', false],
    ['', 'пустой resourcetype', false],
  ];

  it.each(cases)('%s (%s) → %s', (xml, _desc, expected) => {
    expect(isCalendarResource(xml)).toBe(expected);
  });
});

describe('classifyResponse', () => {
  const HOME_URL = 'https://example.com/123/calendars/';
  const ORIGIN = 'https://example.com';

  function respBlock(opts: {
    href: string;
    resourcetype: string;
    vevent?: boolean;
    name?: string;
  }): string {
    return `<d:response>
      <d:href>${opts.href}</d:href>
      <d:propstat><d:prop>
        <d:displayname>${opts.name ?? ''}</d:displayname>
        <d:resourcetype>${opts.resourcetype}</d:resourcetype>
        ${opts.vevent ? '<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>' : ''}
      </d:prop></d:propstat>
    </d:response>`;
  }

  it('href совпадает с homeUrl — root-or-system', () => {
    const r = respBlock({
      href: '/123/calendars/',
      resourcetype: '<d:collection/>',
      vevent: true,
    });
    const c = classifyResponse(r, HOME_URL, ORIGIN);
    expect(c.calendar).toBeNull();
    expect(c.skip).toBe('root-or-system');
  });

  it('inbox/outbox/notification в href — root-or-system', () => {
    const r = respBlock({
      href: '/123/calendars/inbox/',
      resourcetype: '<d:collection/><c:calendar/>',
      vevent: true,
    });
    expect(classifyResponse(r, HOME_URL, ORIGIN).skip).toBe('root-or-system');
  });

  it('нет тега calendar в resourcetype — not-calendar', () => {
    const r = respBlock({
      href: '/123/calendars/shared/',
      resourcetype: '<d:collection/>',
      vevent: true,
    });
    expect(classifyResponse(r, HOME_URL, ORIGIN).skip).toBe('not-calendar');
  });

  it('calendar с атрибутами есть, но нет VEVENT — no-vevent', () => {
    const r = respBlock({
      href: '/123/calendars/tasks/',
      resourcetype:
        '<d:collection/><c:calendar xmlns:c="urn:ietf:params:xml:ns:caldav"/>',
      vevent: false,
    });
    expect(classifyResponse(r, HOME_URL, ORIGIN).skip).toBe('no-vevent');
  });

  it('calendar с атрибутами + VEVENT — принят, с именем и абсолютным url', () => {
    const r = respBlock({
      href: '/123/calendars/home/',
      resourcetype:
        '<d:collection/><C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/>',
      vevent: true,
      name: 'Home',
    });
    const c = classifyResponse(r, HOME_URL, ORIGIN);
    expect(c.skip).toBeNull();
    expect(c.calendar).toEqual({
      url: 'https://example.com/123/calendars/home/',
      name: 'Home',
    });
  });

  // Счётчики диагностики (правило: обязана быть проверка через чистую
  // функцию-фильтр, не через spy на логгер) — тальи по набору ответов.
  it('счётчики по набору ответов складываются верно', () => {
    const responses = [
      respBlock({
        href: '/123/calendars/',
        resourcetype: '<d:collection/>',
        vevent: true,
      }), // root
      respBlock({
        href: '/123/calendars/inbox/',
        resourcetype: '<d:collection/><c:calendar/>',
        vevent: true,
      }), // system
      respBlock({
        href: '/123/calendars/shared/',
        resourcetype: '<d:collection/>',
        vevent: true,
      }), // not-calendar
      respBlock({
        href: '/123/calendars/tasks/',
        resourcetype: '<d:collection/><c:calendar/>',
        vevent: false,
      }), // no-vevent
      respBlock({
        href: '/123/calendars/home/',
        resourcetype: '<d:collection/><c:calendar/>',
        vevent: true,
        name: 'Home',
      }), // ok
      respBlock({
        href: '/123/calendars/work/',
        resourcetype:
          '<d:collection/><C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/>',
        vevent: true,
        name: 'Work',
      }), // ok, с атрибутами
    ];
    const classified = responses.map((r) =>
      classifyResponse(r, HOME_URL, ORIGIN),
    );
    const counts = classified.reduce(
      (acc, c) => {
        if (c.calendar) acc.accepted++;
        else if (c.skip) acc[c.skip]++;
        return acc;
      },
      { accepted: 0, 'root-or-system': 0, 'not-calendar': 0, 'no-vevent': 0 },
    );
    expect(counts).toEqual({
      accepted: 2,
      'root-or-system': 2,
      'not-calendar': 1,
      'no-vevent': 1,
    });
  });
});
