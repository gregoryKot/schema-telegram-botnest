// @vitest-environment jsdom
// ConfirmDialog — Ж4 дизайн-аудита 2026-08: единственный переиспользуемый
// диалог подтверждения (заменил три window.confirm()). Проверяем: подтверждение
// вызывает onConfirm, отмена (клик и клик по фону) — onCancel без onConfirm,
// Escape закрывает (кроме busy — операция уже идёт, не дать закрыть посреди неё),
// доступность (role=dialog/aria-modal, К4/useDialogA11y), busy/error-состояния.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmDialog
      title="Удалить карту режимов?"
      message="Это действие нельзя отменить."
      confirmLabel="Удалить"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { ...utils, onConfirm, onCancel };
}

describe('ConfirmDialog — базовое поведение', () => {
  it('клик по кнопке подтверждения зовёт onConfirm, а не onCancel', () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByText('Удалить'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('клик по «Отмена» зовёт onCancel, а не onConfirm', () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByText('Отмена'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('клик по фону (не по панели) тоже отменяет', () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('клик внутри панели не всплывает до фона (панель не закрывается сама на себе)', () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByText('Это действие нельзя отменить.'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape закрывает (зовёт onCancel)', () => {
    const { onCancel } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('во время busy Escape и клик по фону не закрывают', () => {
    const { onCancel } = renderDialog({ busy: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog — доступность (К4/useDialogA11y)', () => {
  it('панель размечена как диалог с aria-modal', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('заголовок доступен через aria-label', () => {
    renderDialog({ title: 'Отвязать Google?' });
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(
      'Отвязать Google?',
    );
  });
});

describe('ConfirmDialog — busy/error состояния', () => {
  it('busy=true — кнопки задизейблены и показывают busyLabel', () => {
    renderDialog({ busy: true, confirmLabel: 'Удалить', busyLabel: 'Удаляем...' });
    expect(screen.getByText('Удаляем...')).toBeTruthy();
    expect((screen.getByText('Удаляем...') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByText('Отмена') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('error — показан как role=alert', () => {
    renderDialog({ error: 'Не удалось выполнить действие.' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Не удалось выполнить действие.',
    );
  });

  it('без error — role=alert отсутствует', () => {
    renderDialog();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('danger=false — кнопка подтверждения использует акцентный, не тревожный цвет', () => {
    renderDialog({ danger: false });
    const btn = screen.getByText('Удалить') as HTMLButtonElement;
    expect(btn.style.background).toContain('accent');
  });
});
