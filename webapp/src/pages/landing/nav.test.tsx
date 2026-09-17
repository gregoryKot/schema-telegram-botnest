// @vitest-environment jsdom
// nav.tsx (лендинг терапевта) — было 50% покрытия. Проверяем: TgLink рендерит
// корректную ссылку, SectionNav подсвечивает активный пункт, MobileMenu —
// фуллскрин-оверлей на useHistorySheet (закрытие только через goBack, project
// rule), якорный переход скроллит и закрывает меню, внешняя ссылка навигирует
// через location.assign, кнопка записи закрывает меню и открывает форму.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TgLink, SectionNav, MobileMenu } from './nav';

HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(() => cleanup());

describe('TgLink', () => {
  it('ссылка ведёт на t.me/kotlarewski, открывается в новой вкладке', () => {
    render(<TgLink label="Написать" />);
    const link = screen.getByRole('link', { name: /Написать/ });
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('SectionNav', () => {
  it('рендерит все пункты навигации', () => {
    render(<SectionNav />);
    expect(screen.getByText('Обо мне')).toBeTruthy();
    expect(screen.getByText('Цены')).toBeTruthy();
    expect(screen.getByText('Запись')).toBeTruthy();
  });

  it('активный пункт (active="prices") отличается по стилю от остальных', () => {
    render(<SectionNav active="prices" />);
    const active = screen.getByText('Цены');
    const inactive = screen.getByText('Обо мне');
    expect(active.style.color).toBe('var(--accent)');
    expect(inactive.style.color).not.toBe('var(--accent)');
  });
});

describe('MobileMenu — фуллскрин-оверлей', () => {
  it('рендерится как модальный диалог (role=dialog, aria-modal)', () => {
    render(
      <MemoryRouter>
        <MobileMenu onClose={vi.fn()} active="" onBook={vi.fn()} />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Меню' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('клик по «×» закрывает меню (через useHistorySheet)', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <MobileMenu onClose={onClose} active="" onBook={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('Закрыть меню'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по якорному пункту («Обо мне») закрывает меню и скроллит к секции', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const getById = vi.spyOn(document, 'getElementById');
    render(
      <MemoryRouter>
        <MobileMenu onClose={onClose} active="" onBook={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Обо мне'));
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(getById).toHaveBeenCalledWith('about');

    getById.mockRestore();
    vi.useRealTimers();
  });

  it('клик по внешней ссылке («Статьи», /articles) навигирует через location.assign, не закрывает меню вручную', () => {
    const onClose = vi.fn();
    const assignSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign: assignSpy });

    render(
      <MemoryRouter>
        <MobileMenu onClose={onClose} active="" onBook={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Статьи'));

    expect(assignSpy).toHaveBeenCalledWith('/articles');
    expect(onClose).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('активный пункт выделен курсивом и цветом акцента', () => {
    render(
      <MemoryRouter>
        <MobileMenu onClose={vi.fn()} active="prices" onBook={vi.fn()} />
      </MemoryRouter>,
    );
    const activeItem = screen.getByText('Цены');
    expect(activeItem.style.fontStyle).toBe('italic');
  });

  it('«Записаться на знакомство →» закрывает меню и вызывает onBook', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onBook = vi.fn();
    render(
      <MemoryRouter>
        <MobileMenu onClose={onClose} active="" onBook={onBook} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Записаться на знакомство →'));
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(onBook).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
