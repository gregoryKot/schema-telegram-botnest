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
    fireEvent.click(screen.getAllByRole('presentation')[0]);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('клик по самой карточке НЕ зовёт goBack (stopPropagation)', () => {
    const goBack = vi.fn();
    render(
      <BottomSheetShell goBack={goBack} zIndex={300}>
        <div>Содержимое</div>
      </BottomSheetShell>,
    );
    fireEvent.click(screen.getAllByRole('presentation')[1]);
    expect(goBack).not.toHaveBeenCalled();
  });
});
