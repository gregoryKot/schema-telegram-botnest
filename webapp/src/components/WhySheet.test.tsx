// @vitest-environment jsdom
// «Зачем это всё»: подпись по способу открытия, три действия строками одной карточки,
// короткое вступление про пять потребностей, «← Закрыть» в шапке и «Понятно, начнём»
// закрывают лист; кнопка стоит выше оговорки про самопомощь (#906: видна на телефоне).
// Оговорка внизу — строка моста (TherapyLine): без терапевта — «не замена терапии» и «Поговорить →»,
// клиенту со своим терапевтом — про встречи и «Написать терапевту →», самому терапевту — ничего;
// автора приложения лист не рекламирует ни в одной ветке.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WhySheet } from './WhySheet';

const track = vi.hoisted(() => vi.fn());
vi.mock('./therapy/trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const SELF_HELP = /^Приложение — самопомощь, не замена терапии\. Если нужна терапия, есть с кем поговорить\./;
const BETWEEN = /^Приложение — для дней между встречами\. Что всплыло, можно принести на встречу\./;

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

function renderSheet(props: { auto?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(<MemoryRouter><WhySheet auto={props.auto} onClose={onClose} /></MemoryRouter>);
  return onClose;
}

describe('WhySheet', () => {
  // QA 2026-11: фокус оставался на строке «Ещё» под листом, Tab ходил по невидимой странице.
  it('забирает фокус на «← Закрыть», держит Tab внутри и возвращает фокус вызвавшей строке', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Зачем это всё';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<MemoryRouter><WhySheet onClose={vi.fn()} /></MemoryRouter>);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '← Закрыть' }));
    const sheet = screen.getByRole('dialog', { name: 'Зачем это всё' });
    const last = [...sheet.querySelectorAll<HTMLElement>('button, a[href]')].at(-1)!;
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '← Закрыть' }));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('при автопоказе подпись «Первый раз здесь», по кнопке — «Зачем это всё»', () => {
    renderSheet({ auto: true });
    expect(screen.getByText('Первый раз здесь')).toBeTruthy();
    cleanup();
    renderSheet();
    expect(screen.getByText('Зачем это всё', { selector: '.ds-eyebrow' })).toBeTruthy();
    expect(screen.queryByText('Первый раз здесь')).toBeNull();
  });

  it('три действия, итоговая строка и короткое вступление про пять потребностей', () => {
    renderSheet();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Три вещи, которые здесь можно делать');
    const rows = document.querySelectorAll('.cw-list .ds-list-row .ds-list-title');
    expect([...rows].map(r => r.textContent)).toEqual(['Трекер', 'Что случилось', 'Дневник']);
    expect(screen.getByText('Не нужно делать всё. Одно действие в день — уже работа.')).toBeTruthy();
    const lead = document.querySelector('.cw-lead')!.textContent!;
    expect(lead.replace(/\s+/g, ' ')).toBe(
      'Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, автономия, '
      + 'выражение чувств, спонтанность, границы. Когда их долго не хватает, включаются старые паттерны. '
      + 'Приложение помогает это замечать.',
    );
  });

  it('без терапевта: «самопомощь, не замена терапии» и «Поговорить →», событие shown места why', () => {
    renderSheet();
    const foot = screen.getByText(SELF_HELP);
    expect(foot.className).toBe('th-line cw-foot');
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('why', 'shown');
    expect(document.body.textContent).not.toContain('автором приложения');
  });

  it('клиент со своим терапевтом: строка про встречи и «Написать терапевту →», без «не замена терапии»', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    renderSheet();
    expect(screen.getByText(BETWEEN)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Написать терапевту →' }).getAttribute('href')).toBe('tg://user?id=42');
    expect(screen.queryByText(/не замена терапии/)).toBeNull();
    expect(document.body.textContent).not.toContain('автором приложения');
  });

  it('сам терапевт: строки моста нет совсем', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    renderSheet();
    expect(screen.queryByText(/не замена терапии/)).toBeNull();
    expect(screen.queryByText(BETWEEN)).toBeNull();
    expect(document.querySelector('.th-line')).toBeNull();
    expect(document.body.textContent).not.toContain('автором приложения');
    expect(track).not.toHaveBeenCalled();
  });

  it('это диалог на весь экран с шапкой листа', () => {
    renderSheet();
    const dlg = screen.getByRole('dialog');
    expect(dlg.className).toContain('u-sheet');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.querySelector('.ds-sheet-head .ds-back')?.textContent).toBe('← Закрыть');
  });

  it('«Понятно, начнём» стоит выше оговорки про самопомощь и закрывает лист', async () => {
    const onClose = renderSheet();
    const cta = screen.getByText('Понятно, начнём');
    expect(cta.className).toContain('ds-btn--lg');
    const foot = screen.getByText(SELF_HELP);
    expect(cta.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(cta);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('«← Закрыть» в шапке закрывает лист', async () => {
    const onClose = renderSheet();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: '← Закрыть' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
