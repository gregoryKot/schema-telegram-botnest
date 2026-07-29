// @vitest-environment jsdom
// Шапка теста на схемы — общая для обоих фронтендов. Поведение: счётчик
// страниц, прогресс-бар, кнопка «назад» отключена на первой странице,
// «закрыть» всегда активна.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { YsqTestHeader } from './YsqTestHeader';
import { TOTAL_PAGES } from '../hooks/useYsqTest';

afterEach(() => {
  cleanup();
});

describe('YsqTestHeader', () => {
  it('показывает "страница / всего"', () => {
    render(<YsqTestHeader page={2} onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(`3 / ${TOTAL_PAGES}`)).toBeTruthy();
  });

  it('на первой странице (page=0) кнопка «Назад» disabled', () => {
    render(<YsqTestHeader page={0} onBack={vi.fn()} onClose={vi.fn()} />);
    const back = screen.getByLabelText('Назад');
    expect(back.disabled).toBe(true);
  });

  it('на второй странице «Назад» активна и зовёт onBack', () => {
    const onBack = vi.fn();
    render(<YsqTestHeader page={1} onBack={onBack} onClose={vi.fn()} />);
    const back = screen.getByLabelText('Назад');
    expect(back.disabled).toBe(false);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('«Закрыть» всегда активна и зовёт onClose', () => {
    const onClose = vi.fn();
    render(<YsqTestHeader page={0} onBack={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('прогресс-бар растёт с номером страницы', () => {
    const { container, rerender } = render(
      <YsqTestHeader page={0} onBack={vi.fn()} onClose={vi.fn()} />,
    );
    // Ищем полосу по признаку процентной ширины — вёрстка вокруг может
    // меняться, а контракт «есть элемент шириной N%» — это и есть прогресс.
    const bar = () => {
      const divs = Array.from(container.querySelectorAll('div'));
      const el = divs.find((d) => d.style.width.endsWith('%'));
      if (!el) throw new Error('прогресс-бар (width в %) не найден');
      return el.style.width;
    };
    const firstWidth = parseFloat(bar());
    rerender(
      <YsqTestHeader
        page={TOTAL_PAGES - 1}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const lastWidth = parseFloat(bar());
    expect(lastWidth).toBeGreaterThan(firstWidth);
    expect(lastWidth).toBe(100);
  });
});
