// @vitest-environment jsdom
// Вебвизор Метрики на визитке (kotlarewski.gr) снимает DOM целиком; исключить
// узел можно только классом `ym-hide-content`. Секреты клиента — ссылка встречи
// (Zoom с ?pwd=), cancelToken (просмотр/.ics/отмена брони без другой проверки),
// payUrl Робокассы — не должны лежать в DOM вне такого узла (аудит 2026-10,
// security#26). Защита едет с КОМПОНЕНТОМ: путь, по которому Вебвизор включён,
// проверяется отдельно (metrikaRoutes.test.ts), но главная содержит секцию
// записи, и SPA-переход не перезапускает рекордер.
//
// Тест на класс, не на строку: (1) каждый компонент, получающий секрет,
// рендерится с узнаваемыми значениями, и любой href/src с ними обязан иметь
// предка `.ym-hide-content`, а в текстовых нодах значения быть не должно;
// (2) реестр сверяется с исходниками — новый файл с такими пропами, которого нет
// в реестре, роняет тест (правило №4).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

vi.mock('../../api', () => ({
  api: { getBookingByToken: vi.fn(), cancelBooking: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { DoneScreen, AwaitPaymentScreen } from './BookingResultScreens';
import { BookingSaveBlock, MEETING_LINK_LATER } from './BookingSaveBlock';
import { BookingCancelControl } from './BookingCancelControl';
import { BookingPaidPage } from '../../pages/BookingPaidPage';
import { BookingConfirmedView } from './BookingConfirmedView';
import { BookingMeetingLink } from '../../pages/admin/BookingMeetingLink';

const TOKEN = '11111111-2222-4333-8444-555555555555';
const PWD = 'SeCrEtPaSsCoDe';
const ZOOM = `https://us06web.zoom.us/j/81234567890?pwd=${PWD}`;
const PAY = 'https://auth.robokassa.ru/Merchant/Index.aspx?InvId=987654321&SignatureValue=PaYsIgN';
const SECRETS = [TOKEN, PWD, 'PaYsIgN'];
// Далеко в будущем: кнопка отмены (BookingCancelControl) остаётся на экране.
const startsAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
const slot = { startsAt, durationMin: 50 } as never;

afterEach(cleanup);

const URL_ATTRS = ['href', 'src', 'action', 'formaction'];

/** Элементы, в чьих url-атрибутах (в том числе в percent-кодировке) есть секрет. */
function carriers(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('*')].filter((el) =>
    URL_ATTRS.some((a) => {
      const v = el.getAttribute(a);
      if (!v) return false;
      let decoded = v;
      try { decoded = decodeURIComponent(v); } catch { /* оставляем как есть */ }
      return SECRETS.some((s) => v.includes(s) || decoded.includes(s));
    }));
}

/** Нарушения: секрет в url-атрибуте вне `.ym-hide-content` либо где угодно в тексте. */
function violations(container: HTMLElement): string[] {
  const out = carriers(container)
    .filter((el) => !el.closest('.ym-hide-content'))
    .map((el) => `вне ym-hide-content: <${el.tagName.toLowerCase()} ${el.getAttribute('href') ?? ''}>`);
  for (const s of SECRETS) {
    if ((container.textContent ?? '').includes(s)) out.push(`секрет «${s}» в текстовой ноде`);
  }
  return out;
}

describe('помощник violations (контроль: тест умеет краснеть)', () => {
  it('голая ссылка с токеном и секрет в тексте — нарушения; под ym-hide-content — чисто', () => {
    const bare = render(<div><a href={`/m?token=${TOKEN}`}>{ZOOM}</a></div>);
    expect(violations(bare.container)).toHaveLength(2);
    cleanup();
    const hidden = render(<div className="ym-hide-content"><a href={`/m?token=${TOKEN}`}>ссылка</a></div>);
    expect(carriers(hidden.container)).toHaveLength(1);
    expect(violations(hidden.container)).toEqual([]);
  });
});

describe('компоненты с секретами: DOM под ym-hide-content', () => {
  it('DoneScreen: токен в href — под скрытым узлом; ссылки на встречу нет (аудит 2026-10)', () => {
    const { container } = render(
      <DoneScreen resultRef={createRef<HTMLDivElement>()} slot={slot} tz="Europe/Moscow" cancelled={false}
        cancelToken={TOKEN} sessionType="SESSION_50" onCancelled={() => {}} />,
    );
    expect(carriers(container).length).toBeGreaterThanOrEqual(3); // Google, .ics, Telegram
    expect(violations(container)).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Открыть встречу' })).toBeNull();
    expect(screen.getByText(MEETING_LINK_LATER)).toBeTruthy();
  });

  it('AwaitPaymentScreen: ссылка на оплату Робокассы — под скрытым узлом', () => {
    const { container } = render(
      <AwaitPaymentScreen resultRef={createRef<HTMLDivElement>()} slot={slot} tz="Europe/Moscow" priceText={null} payUrl={PAY} />,
    );
    expect(carriers(container)).toHaveLength(1);
    expect(violations(container)).toEqual([]);
  });

  it('BookingSaveBlock: отдельно от родителя защищён собственным корнем', () => {
    const { container } = render(
      <BookingSaveBlock cancelToken={TOKEN} startsAt={startsAt} durationMin={50} type="SESSION_50" tz="Europe/Moscow" />,
    );
    expect(carriers(container).length).toBeGreaterThanOrEqual(3);
    expect(violations(container)).toEqual([]);
  });

  it('BookingCancelControl: токен не попадает в DOM вовсе (используется только в вызове API)', () => {
    const { container } = render(<BookingCancelControl cancelToken={TOKEN} startsAt={startsAt} onCancelled={() => {}} />);
    expect(container.innerHTML).not.toContain(TOKEN);
    expect(violations(container)).toEqual([]);
  });

  it('BookingConfirmedView: отдельно от страницы защищён собственным корнем', () => {
    const { container } = render(
      <BookingConfirmedView
        booking={{ status: 'CONFIRMED', type: 'SESSION_50', startsAt, durationMin: 50 } as never}
        token={TOKEN} onCancelled={() => {}}
      />,
    );
    expect(carriers(container).length).toBeGreaterThanOrEqual(3); // ссылки BookingSaveBlock
    expect(violations(container)).toEqual([]);
  });

  it('BookingMeetingLink (админка): ссылка на встречу — под скрытым узлом', () => {
    const { container } = render(<BookingMeetingLink meetingUrl={ZOOM} />);
    expect(carriers(container)).toHaveLength(1);
    expect(violations(container).filter((v) => !v.includes(PWD))).toEqual([]);
    // текст ссылки виден владельцу (её надо переслать), но весь узел скрыт
    expect(container.querySelector('.ym-hide-content')?.textContent).toContain(PWD);
  });

  it('BookingPaidPage: после загрузки по токену управление записью — под скрытым узлом', async () => {
    window.history.pushState({}, '', `/booking/manage?token=${TOKEN}`);
    vi.mocked(api.getBookingByToken).mockResolvedValue({
      status: 'CONFIRMED', paid: true, type: 'SESSION_50', startsAt, endsAt: startsAt, durationMin: 50,
    } as never);
    const { container } = render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    expect(carriers(container).length).toBeGreaterThanOrEqual(3);
    expect(violations(container)).toEqual([]);
    window.history.pushState({}, '', '/');
  });
});

// ── Реестр: файл, где в коде есть секретное имя, обязан быть классифицирован ──
const SECRET_NAME = /\b(cancelToken|meetingUrl|payUrl|paymentUrl)\b/;
const REGISTRY: Record<string, string> = {
  'components/booking/BookingResultScreens.tsx': 'рендерит: DoneScreen, AwaitPaymentScreen — тест выше',
  'components/booking/BookingSaveBlock.tsx': 'рендерит — тест выше',
  'components/booking/BookingCancelControl.tsx': 'токен только в вызове API, в DOM нет — тест выше',
  'components/booking/BookingConfirmedView.tsx': 'рендерит (экран CONFIRMED страницы после оплаты) — тест выше',
  'components/BookingPicker.tsx': 'держит секреты в state и отдаёт экранам выше; сам их не рисует',
  'pages/DonatePage.tsx': 'paymentUrl только для window.location.href, в DOM нет',
  'pages/SubscribePage.tsx': 'paymentUrl только для window.location.href, в DOM нет',
  'api.ts': 'клиент API: типы и запросы, DOM нет',
  'api.types.ts': 'типы, DOM нет',
  'pages/admin/BookingsManager.tsx': 'передаёт meetingUrl в BookingMeetingLink; сам ссылку не рисует, /admin Вебвизор не пишет (metrika.test.ts)',
  'pages/admin/BookingMeetingLink.tsx': 'рендерит ссылку владельцу под ym-hide-content — тест выше',
};

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') sources(p, acc); continue; }
    if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

describe('реестр компонентов с секретами сверен с исходниками (правило №4)', () => {
  const root = resolve(__dirname, '../..');
  const stripped = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const withSecrets = sources(root)
    .filter((p) => SECRET_NAME.test(stripped(p)))
    .map((p) => p.slice(root.length + 1));

  it('каждый файл с cancelToken/meetingUrl/payUrl/paymentUrl есть в реестре', () => {
    expect(withSecrets.filter((f) => !(f in REGISTRY))).toEqual([]);
  });

  it('в реестре нет протухших записей', () => {
    expect(Object.keys(REGISTRY).filter((f) => !withSecrets.includes(f))).toEqual([]);
  });

  it('shared/ не получает секреты записи (иначе реестр придётся расширить на оба фронтенда)', () => {
    const shared = sources(resolve(root, '../../shared/src')).filter((p) => SECRET_NAME.test(stripped(p)));
    expect(shared.map((p) => p.slice(resolve(root, '../..').length + 1))).toEqual([]);
  });
});
