// @vitest-environment jsdom
// DiariesOverlay — тонкая обёртка вокруг DiarySection. К4 дизайн-аудита
// 2026-08: оверлей размечен как диалог (useDialogA11y), без своего теста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiariesOverlay } from './DiariesOverlay';

vi.mock('../sections/DiarySection', () => ({
  DiarySection: () => <div>Мои дневники</div>,
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
});
