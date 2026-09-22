// @vitest-environment jsdom
// Баннер куки — теперь просто уведомление, метрика грузится безусловно
// (владелец решил не ждать согласия). Проверяем: на чистом localStorage
// баннер показан, а метрика уже грузится без всякого клика; кнопка
// «Понятно» скрывает баннер и пишет cookie_consent='all'; при любом уже
// сохранённом решении ('all' или 'necessary') баннера нет, метрика всё
// равно подключена; init — без webvisor.
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
