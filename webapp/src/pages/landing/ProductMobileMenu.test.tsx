// @vitest-environment jsdom
// ProductMobileMenu (В4, аудит 2026-08) — .pl2-nav скрывался ≤640px без
// замены, ссылки становились недостижимы с телефона. Проверяем: фуллскрин
// role=dialog, закрытие через useHistorySheet, якорный переход скроллит и
// закрывает меню, ссылка на /tests навигирует через location.assign, «Войти»
// ведёт на /login.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductMobileMenu } from './ProductMobileMenu';
import { BAND_HUE, NAV_LINKS } from './productContent';

HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(() => cleanup());

function renderMenu(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <ProductMobileMenu onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('ProductMobileMenu', () => {
  it('рендерится как модальный диалог со всеми пунктами навигации + «Войти»', () => {
    renderMenu();
    const dialog = screen.getByRole('dialog', { name: 'Меню' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Как это работает')).toBeTruthy();
    expect(screen.getByText('Возможности')).toBeTruthy();
    expect(screen.getByText('Тесты')).toBeTruthy();
    expect(screen.getByText('Статьи')).toBeTruthy();
    expect(screen.getByText('Вопросы')).toBeTruthy();
    const login = screen.getByText('Войти');
    expect(login.getAttribute('href')).toBe('/login');
  });

  it('клик по «×» закрывает меню (через useHistorySheet)', () => {
    const onClose = renderMenu();
    fireEvent.click(screen.getByLabelText('Закрыть меню'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по якорному пункту («Как это работает») закрывает меню и скроллит к секции', () => {
    vi.useFakeTimers();
    const onClose = renderMenu();
    const getById = vi.spyOn(document, 'getElementById');

    fireEvent.click(screen.getByText('Как это работает'));
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(getById).toHaveBeenCalledWith('how');

    getById.mockRestore();
    vi.useRealTimers();
  });

  it('клик по «Тесты» (не якорь) навигирует через location.assign, не закрывает меню вручную', () => {
    const onClose = renderMenu();
    const assignSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign: assignSpy });

    fireEvent.click(screen.getByText('Тесты'));

    expect(assignSpy).toHaveBeenCalledWith('/tests');
    expect(onClose).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  // Соседи — по горизонтали и вертикали в сетке телефона (2 колонки) и планшета (3 колонки,
  // product-landing-menu.css): разной бумаги, то есть дальше 45° по кругу оттенков (25 и 45
  // рядом читались одним розовым, 195 над 195 на планшете — одной плиткой).
  it.each([2, 3])('плитка секции с полосой — оттенка полосы; соседи на %i колонках разной бумаги', (cols) => {
    renderMenu();
    const hue = (label: string) => (screen.getByText(label).closest('a') as HTMLElement).style.getPropertyValue('--h');
    expect(hue('Как это работает')).toBe(String(BAND_HUE.how));
    expect(hue('Приложение')).toBe(String(BAND_HUE.app));
    expect(hue('Вопросы')).toBe(String(BAND_HUE.faq));
    const hues = NAV_LINKS.map((l) => l.hue);
    const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    for (let i = 0; i < hues.length; i++) {
      if (i % cols !== cols - 1 && i + 1 < hues.length) expect(apart(hues[i], hues[i + 1]), `ряд, пункт ${i + 1}`).toBeGreaterThanOrEqual(45);
      if (i + cols < hues.length) expect(apart(hues[i], hues[i + cols]), `столбец, пункт ${i + 1}`).toBeGreaterThanOrEqual(45);
    }
  });

  it('знак «Статей» — обложка карточки статьи в миниатюре, «Вопросов» — тот же, что у секции', () => {
    renderMenu();
    const sign = (label: string) => (screen.getByText(label).closest('a') as HTMLElement).querySelector('.pl2-menu-sign') as HTMLElement;
    expect(sign('Статьи').querySelector('svg.scn')).not.toBeNull();
    expect(sign('Вопросы').querySelector('.scn-sign')).not.toBeNull();
  });
});
