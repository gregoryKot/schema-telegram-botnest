// @vitest-environment jsdom
// Оболочка «лист снизу» (webapp) — общая для ShareCardSheet и
// PhraseHistoryCard (правило «одна механика — один компонент»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BottomSheetShell } from './BottomSheetShell';

afterEach(cleanup);

describe('BottomSheetShell', () => {
  it('рендерит children внутри карточки', () => {
    render(
      <BottomSheetShell goBack={vi.fn()} zIndex={300}>
        <div>Содержимое</div>
      </BottomSheetShell>,
    );
    expect(screen.getByText('Содержимое')).toBeTruthy();
  });

  it('клик по бэкдропу зовёт goBack', () => {
    const goBack = vi.fn();
    render(
      <BottomSheetShell goBack={goBack} zIndex={300}>
        <div>Содержимое</div>
      </BottomSheetShell>,
    );
    fireEvent.click(screen.getByRole('presentation'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('клик по самой карточке НЕ зовёт goBack (stopPropagation)', () => {
    const goBack = vi.fn();
    render(
      <BottomSheetShell goBack={goBack} zIndex={300}>
        <div>Содержимое</div>
      </BottomSheetShell>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.click(screen.getByText('Содержимое'));
    expect(goBack).not.toHaveBeenCalled();
  });

  it('карточка — модальный диалог с подписью', () => {
    render(
      <BottomSheetShell goBack={vi.fn()} zIndex={300} label="Поделиться">
        <div>Содержимое</div>
      </BottomSheetShell>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Поделиться');
  });

  it('zIndex уходит на бэкдроп, классы дают десктопное окно', () => {
    render(
      <BottomSheetShell goBack={vi.fn()} zIndex={321}>
        <div>Содержимое</div>
      </BottomSheetShell>,
    );
    const backdrop = screen.getByRole('presentation');
    expect(backdrop.className).toBe('sheet-modal');
    expect(backdrop.style.zIndex).toBe('321');
    expect(screen.getByRole('dialog').className).toBe('sheet-modal-box');
  });

  it('maxWidth — только если задан', () => {
    const { rerender } = render(
      <BottomSheetShell goBack={vi.fn()} zIndex={300}>
        <div>x</div>
      </BottomSheetShell>,
    );
    expect(screen.getByRole('dialog').style.maxWidth).toBe('');
    rerender(
      <BottomSheetShell goBack={vi.fn()} zIndex={300} maxWidth={440}>
        <div>x</div>
      </BottomSheetShell>,
    );
    expect(screen.getByRole('dialog').style.maxWidth).toBe('440px');
  });
});
