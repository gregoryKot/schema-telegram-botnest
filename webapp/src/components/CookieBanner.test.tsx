// @vitest-environment jsdom
// Баннер куки — теперь просто уведомление, метрика грузится безусловно
// (владелец решил не ждать согласия). Проверяем: на чистом localStorage
// баннер показан, а метрика уже грузится без всякого клика; кнопка
// «Понятно» скрывает баннер и пишет cookie_consent='all'; при любом уже
// сохранённом решении ('all' или 'necessary') баннера нет, метрика всё
// равно подключена; init — без webvisor (тесты этого файла гоняются на
// не-визитке — jsdom-хост localhost; условие «только визитка» и его
// переключение по пути /admin проверены отдельно в lib/metrika.test.ts).
// На визитке практики (kotlarewski.*) вместо высокой карточки — компактная
// строка: карточка на телефоне закрывала главную кнопку первого экрана, а
// фраза про вход там лишняя (входа на визитке нет). Продуктовый хост
// рисуется как раньше.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CookieBanner } from './CookieBanner';

beforeEach(() => {
  localStorage.clear();
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
});

afterEach(() => {
  cleanup();
});

// Подмена хоста: isPracticeHost() читает window.location.hostname (образец —
// LandingPage.test.tsx). Восстанавливается в afterEach блока ниже.
const originalLocation = window.location;
function stubHost(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname, pathname: '/', href: `https://${hostname}/` },
    configurable: true,
    writable: true,
  });
}

describe('CookieBanner — первый визит', () => {
  it('на чистом localStorage баннер показан', () => {
    render(<CookieBanner />);
    expect(screen.getByRole('dialog', { name: 'Уведомление об использовании куки' })).toBeTruthy();
  });

  it('метрика грузится сразу, без клика по баннеру', () => {
    render(<CookieBanner />);
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeTruthy();
  });

  it('«Понятно» скрывает баннер и сохраняет решение', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('cookie_consent')).toBe('all');
  });

  it('метрика инициализируется БЕЗ webvisor — клинический текст SPA не уходит в Яндекс (H2)', () => {
    render(<CookieBanner />);

    const ym = (window as unknown as { ym?: { a?: unknown[][] } }).ym;
    const initCall = ym?.a?.find((c) => c[1] === 'init');
    expect(initCall).toBeTruthy();
    expect((initCall![2] as { webvisor?: boolean }).webvisor).toBe(false);
  });
});

describe('CookieBanner — повторный визит (решение уже сохранено)', () => {
  it('consent=necessary — баннер не показывается, метрика всё равно грузится', () => {
    localStorage.setItem('cookie_consent', 'necessary');
    render(<CookieBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeTruthy();
  });

  it('consent=all — баннера нет, метрика подключается', () => {
    localStorage.setItem('cookie_consent', 'all');
    render(<CookieBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeTruthy();
  });
});

describe('CookieBanner — визитка практики (kotlarewski.gr): компактный вариант', () => {
  beforeEach(() => stubHost('kotlarewski.gr'));
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
  });

  it('показывает короткий текст про Метрику и ссылку «Подробнее» на /privacy#cookies', () => {
    render(<CookieBanner />);
    const dialog = screen.getByRole('dialog', { name: 'Уведомление об использовании куки' });
    expect(dialog.textContent).toContain('Сайт обезличенно считает посещения в Яндекс.Метрике.');
    const link = screen.getByRole('link', { name: 'Подробнее' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/privacy#cookies');
  });

  it('не показывает текст про вход и заголовок карточки — входа на визитке нет', () => {
    render(<CookieBanner />);
    expect(screen.queryByText(/нужна для входа/)).toBeNull();
    expect(screen.queryByText('Немного о куки')).toBeNull();
  });

  it('«Понятно» скрывает баннер и сохраняет решение', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('cookie_consent')).toBe('all');
  });

  it('метрика грузится и в компактном варианте — без клика', () => {
    render(<CookieBanner />);
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeTruthy();
  });

  it('при сохранённом решении баннера нет и на визитке', () => {
    localStorage.setItem('cookie_consent', 'all');
    render(<CookieBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CookieBanner — продуктовый хост (schemehappens.ru): карточка как раньше', () => {
  beforeEach(() => stubHost('schemehappens.ru'));
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true });
  });

  it('показывает заголовок «Немного о куки» и текст про вход', () => {
    render(<CookieBanner />);
    expect(screen.getByText('Немного о куки')).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('Часть нужна для входа');
  });

  it('«Понятно» скрывает карточку и сохраняет решение', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('cookie_consent')).toBe('all');
  });
});
