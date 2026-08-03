// @vitest-environment jsdom
// Баннер согласия на куки: показ на чистом localStorage, выбор «только
// необходимые»/«принять все» персистится, повторный маунт баннер не рисует.
// Загрузка Яндекс.Метрики — только с явного согласия (accept), не по декланту.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CookieBanner } from './CookieBanner';

beforeEach(() => {
  localStorage.clear();
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
});

afterEach(() => {
  cleanup();
});

describe('CookieBanner — первый визит', () => {
  it('на чистом localStorage баннер показан', () => {
    render(<CookieBanner />);
    expect(screen.getByRole('dialog', { name: 'Согласие на использование куки' })).toBeTruthy();
  });

  it('«Только необходимые» скрывает баннер, сохраняет выбор, метрику НЕ грузит', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Только необходимые' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('cookie_consent')).toBe('necessary');
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeNull();
  });

  it('«Принять все» скрывает баннер, сохраняет выбор и подключает метрику', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Принять все' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('cookie_consent')).toBe('all');
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeTruthy();
  });
});

describe('CookieBanner — повторный визит (решение уже сохранено)', () => {
  it('consent=necessary — баннер не показывается снова', () => {
    localStorage.setItem('cookie_consent', 'necessary');
    render(<CookieBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('consent=all — баннера нет, метрика подключается автоматически', () => {
    localStorage.setItem('cookie_consent', 'all');
    render(<CookieBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('script[src*="mc.yandex.ru"]')).toBeTruthy();
  });
});
