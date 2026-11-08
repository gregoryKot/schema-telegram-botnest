// @vitest-environment jsdom
// NeedAdviceModal — общий оверлей «О советах» под шитами потребности
// (0% покрытия). Ключевой инвариант: терапевту не предлагаем ссылку на
// самого себя (isTherapist=true скрывает CTA) — регрессия здесь означает,
// что терапевт видит нелепую кнопку «Написать себе».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { useEffect, useState, type ReactElement } from 'react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { NeedAdviceModal } from './NeedAdviceModal';
import { useHistorySheet } from '../hooks/useHistorySheet';

// Шторка держит свою запись истории (useHistorySheet) — ей нужен роутер.
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('NeedAdviceModal', () => {
  // К4 дизайн-аудита 2026-08: панель — role="dialog"/aria-modal (useDialogA11y).
  it('панель размечена как диалог', () => {
    render(<NeedAdviceModal onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('рендерит объяснение назначения советов', () => {
    render(<NeedAdviceModal onClose={vi.fn()} />);
    expect(screen.getByText('О советах')).toBeTruthy();
    expect(screen.getByText(/Советы внутри — это приглашение к размышлению/)).toBeTruthy();
  });

  it('обычный клиент видит CTA «Записаться на консультацию»', () => {
    render(<NeedAdviceModal onClose={vi.fn()} />);
    expect(screen.getByText('→ Записаться на консультацию')).toBeTruthy();
  });

  it('сам терапевт не видит CTA на самого себя', () => {
    localStorage.setItem('therapy_contact_url', 'https://t.me/someone');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    render(<NeedAdviceModal onClose={vi.fn()} />);
    expect(screen.queryByText('→ Записаться на консультацию')).toBeNull();
  });

  it('клик по фону закрывает оверлей', async () => {
    const onClose = vi.fn();
    render(<NeedAdviceModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('presentation'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('кнопка «Понятно» закрывает оверлей', async () => {
    const onClose = vi.fn();
    render(<NeedAdviceModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  // Шторка «О советах» лежит поверх NeedTodaySheet/NeedHistorySheet: с локальным onClose
  // системное «Назад» снимало запись листа под ней — закрывался лист, а шторка висела.
  it('«Назад» браузера закрывает шторку, а лист потребности под ней остаётся', async () => {
    const snap = { nav: null as NavigateFunction | null };
    const sheetClosed = vi.fn();
    function NeedSheet() {
      const nav = useNavigate();
      useEffect(() => { snap.nav = nav; });
      useHistorySheet(sheetClosed); // лист потребности со своей записью истории
      const [advice, setAdvice] = useState(false);
      return (
        <div data-testid="need-sheet">
          <button onClick={() => setAdvice(true)}>о советах</button>
          {advice && <NeedAdviceModal onClose={() => setAdvice(false)} />}
        </div>
      );
    }
    render(<NeedSheet />);
    await act(async () => {});
    fireEvent.click(screen.getByText('о советах'));
    expect(screen.getByText('О советах')).toBeTruthy();
    await act(async () => {});
    await act(async () => { snap.nav!(-1); });
    await waitFor(() => expect(screen.queryByText('О советах')).toBeNull());
    expect(sheetClosed).not.toHaveBeenCalled();
    expect(screen.getByTestId('need-sheet')).toBeTruthy();
  });

  it('клик по самой карточке НЕ закрывает оверлей (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<NeedAdviceModal onClose={onClose} />);
    fireEvent.click(screen.getByText('О советах'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
