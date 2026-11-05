// @vitest-environment jsdom
// Шторка карты на телефоне живёт в истории: «Назад» закрывает её, а не уводит из
// карточки клиента (QA 2026-11, T-3); меню «Новая карта» прижимается к краю (T-6).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { MobileDrawer } from './MobileDrawer';
import { Dropdown } from '../Dropdown';

afterEach(cleanup);

function Where() {
  const loc = useLocation();
  return <span data-testid="path">{loc.pathname}</span>;
}
function Back() {
  const nav = useNavigate();
  return <button onClick={() => nav(-1)}>браузерный назад</button>;
}

describe('MobileDrawer', () => {
  it('«Назад» браузера закрывает шторку и остаётся на странице', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={['/cabinet/5']}>
        <Where /><Back />
        <MobileDrawer side="right" onClose={onClose} content={() => <p>панель узла</p>} />
      </MemoryRouter>,
    );
    expect(screen.getByText('панель узла')).toBeTruthy();
    fireEvent.click(screen.getByText('браузерный назад'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('path').textContent).toBe('/cabinet/5');
  });

  it('кнопка из содержимого закрывает через goBack и запись истории снимается', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={['/cabinet/5']}>
        <MobileDrawer side="right" onClose={onClose} content={(goBack) => <button onClick={() => goBack()}>×</button>} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('×'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('Dropdown width', () => {
  it('меню шире 220 прижимается к правому краю: левый край = экран − 8 − ширина', () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    const ref = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={ref} />
        <Dropdown onClose={() => {}} anchorRef={ref} width={290}><span>пункт</span></Dropdown>
      </div>,
    );
    const menu = screen.getByText('пункт').parentElement as HTMLElement;
    // якорь в jsdom стоит в 0, значит прижатие не нужно; сдвигаем якорь вправо
    expect(menu.style.left).toBe('8px');
    cleanup();
    ref.current = null;
    const anchor = createRef<HTMLDivElement>();
    render(
      <div>
        <div ref={(el) => { anchor.current = el; if (el) el.getBoundingClientRect = () => ({ left: 155, bottom: 40 } as DOMRect); }} />
        <Dropdown onClose={() => {}} anchorRef={anchor} width={290}><span>пункт</span></Dropdown>
      </div>,
    );
    const menu2 = screen.getByText('пункт').parentElement as HTMLElement;
    expect(menu2.style.left).toBe('92px');
  });
});
