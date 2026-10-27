// @vitest-environment jsdom
// «Зачем это всё»: подпись по способу открытия, три действия, переиспользованные
// тексты про потребности, «Понятно, начнём» закрывает лист.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WhySheet } from './WhySheet';
import { TRACKER_ORIGIN_NOTE } from '../../../shared/src/needs/trackerOnboarding';
import { NEEDS_EXPLAINER } from '../../../shared/src/about/aboutData';

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

  it('три действия, итоговая строка и тексты про потребности из общих источников', () => {
    renderSheet();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Три вещи, которые здесь можно делать');
    for (const t of ['Трекер', 'Что случилось', 'Дневник']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText('Не нужно делать всё. Одно действие в день — уже работа.')).toBeTruthy();
    const lead = document.querySelector('.cw-lead')!.textContent!;
    expect(lead).toContain(TRACKER_ORIGIN_NOTE);
    for (const n of NEEDS_EXPLAINER) expect(lead).toContain(n.name.toLowerCase());
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
