// @vitest-environment jsdom
// «Зачем это всё»: подпись по способу открытия, три действия, короткое
// вступление про пять потребностей, «Понятно, начнём» закрывает лист.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WhySheet } from './WhySheet';

afterEach(cleanup);

function renderSheet(props: { auto?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(<MemoryRouter><WhySheet auto={props.auto} onClose={onClose} /></MemoryRouter>);
  return onClose;
}

describe('WhySheet', () => {
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
    for (const t of ['Трекер', 'Что случилось', 'Дневник']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText('Не нужно делать всё. Одно действие в день — уже работа.')).toBeTruthy();
    expect(screen.getByText(/^Это самопомощь, не замена терапии\. Если станет тяжело подолгу, приложение само предложит поговорить с автором приложения, который работает в подходе схема-терапия\.$/)).toBeTruthy();
    const lead = document.querySelector('.cw-lead')!.textContent!;
    expect(lead.replace(/\s+/g, ' ')).toBe(
      'Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, автономия, '
      + 'выражение чувств, спонтанность, границы. Когда их долго не хватает, включаются старые паттерны. '
      + 'Приложение помогает это замечать.',
    );
  });

  it('это диалог на весь экран', () => {
    renderSheet();
    const dlg = screen.getByRole('dialog');
    expect(dlg.className).toContain('u-sheet');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
  });

  it('«Понятно, начнём» закрывает лист', async () => {
    const onClose = renderSheet();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText('Понятно, начнём'));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
