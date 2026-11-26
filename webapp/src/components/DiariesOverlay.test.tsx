// @vitest-environment jsdom
// DiariesOverlay — тонкая обёртка вокруг DiarySection. К4 дизайн-аудита
// 2026-08: оверлей размечен как диалог (useDialogA11y), без своего теста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiariesOverlay } from './DiariesOverlay';

vi.mock('../sections/DiarySection', () => ({
  DiarySection: (p: { onOpenTrackerHistory?: () => void }) => (
    <div>
      Мои дневники
      <button onClick={p.onOpenTrackerHistory}>история трекера</button>
    </div>
  ),
}));

afterEach(cleanup);

describe('DiariesOverlay', () => {
  it('размечен как диалог', () => {
    render(
      <MemoryRouter>
        <DiariesOverlay onClose={vi.fn()} />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('рендерит DiarySection внутри', () => {
    render(
      <MemoryRouter>
        <DiariesOverlay onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Мои дневники')).toBeTruthy();
  });

  it('передаёт в DiarySection переход к истории трекера', () => {
    const onOpenTrackerHistory = vi.fn();
    render(
      <MemoryRouter>
        <DiariesOverlay onClose={vi.fn()} onOpenTrackerHistory={onOpenTrackerHistory} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('история трекера'));
    expect(onOpenTrackerHistory).toHaveBeenCalledTimes(1);
  });

  // b11: до 2026-11 шапки у листа не было (DiarySection игнорировал onClose) — выйти можно было
  // только системным «назад», на компьютере лист закрывал рабочую область без выхода.
  it('«Назад» в шапке листа закрывает его через goBack (useHistorySheet)', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <DiariesOverlay onClose={onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
