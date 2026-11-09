// @vitest-environment jsdom
// Dialog — единый центрированный диалог сайта. Проверяем разметку для
// скринридера, фокус-ловушку, закрытие (бэкдроп / Escape только по флагу) и
// что клик внутри окна не доходит до бэкдропа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Dialog } from './Dialog';

afterEach(cleanup);

function renderDialog(props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  return render(
    <Dialog label="Подтверждение" {...props}>
      <button>Первая</button>
      <button>Вторая</button>
    </Dialog>,
  );
}

describe('Dialog — разметка', () => {
  it('role=dialog, aria-modal и подпись окна', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Подтверждение');
    expect(dialog.className).toContain('sk-dialog-box');
    expect(dialog.className).not.toContain('sk-dialog-box--center');
  });

  it('center, maxWidth и zIndex доезжают до разметки', () => {
    renderDialog({ center: true, maxWidth: 360, zIndex: 450 });
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('sk-dialog-box--center');
    expect(dialog.style.maxWidth).toBe('360px');
    expect((dialog.parentElement as HTMLElement).style.zIndex).toBe('450');
  });

  it('underlay рисуется внутри бэкдропа, до окна', () => {
    renderDialog({ underlay: <i data-testid="under" /> });
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    expect(backdrop.firstElementChild).toBe(screen.getByTestId('under'));
  });
});

describe('Dialog — фокус', () => {
  it('фокус уходит внутрь окна, Tab с последней кнопки возвращает на первую', () => {
    renderDialog();
    const first = screen.getByText('Первая');
    const last = screen.getByText('Вторая');
    expect(document.activeElement).toBe(first);
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });
});

describe('Dialog — закрытие', () => {
  it('клик по бэкдропу зовёт onClose, клик внутри окна — нет', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByText('Первая'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('без onClose клик по бэкдропу ничего не закрывает', () => {
    renderDialog();
    expect(() =>
      fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement),
    ).not.toThrow();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Escape закрывает только с closeOnEscape', () => {
    const onClose = vi.fn();
    const { unmount } = renderDialog({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
    renderDialog({ onClose, closeOnEscape: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeOnEscape без onClose (busy) — Escape молчит', () => {
    renderDialog({ closeOnEscape: true });
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

// Аудит 2026-10: у каждого Dialog был свой document-слушатель Escape, без
// стека — одно нажатие закрывало все окна с closeOnEscape разом.
describe('Dialog — несколько окон', () => {
  it('Escape закрывает только верхнее окно с closeOnEscape', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(
      <>
        <Dialog label="Нижнее" closeOnEscape onClose={lower}>
          <button>a</button>
        </Dialog>
        <Dialog label="Верхнее" closeOnEscape onClose={upper}>
          <button>b</button>
        </Dialog>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });

  it('верхнее окно без closeOnEscape: Escape не закрывает нижнее', () => {
    const lower = vi.fn();
    render(
      <>
        <Dialog label="Нижнее" closeOnEscape onClose={lower}>
          <button>a</button>
        </Dialog>
        <Dialog label="Верхнее">
          <button>b</button>
        </Dialog>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(lower).not.toHaveBeenCalled();
  });
});

// Аудит 2026-11: окно, открытое касанием или само, показывало кольцо фокуса на первой кнопке
// (Chrome даёт :focus-visible программному фокусу) — «На «ты»» выглядела выбранной. Кольцо —
// только с клавиатуры: «тихое» окно (data-focus="quiet", dialogs.css) до первой клавиши перехода.
describe('Dialog — кольцо фокуса только с клавиатуры', () => {
  it('открыто касанием: окно тихое, фокус всё равно внутри; Tab возвращает кольцо', () => {
    fireEvent.pointerDown(document.body);
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-focus')).toBe('quiet');
    expect(document.activeElement).toBe(screen.getByText('Первая'));
    fireEvent.keyDown(screen.getByText('Первая'), { key: 'Tab' });
    expect(dialog.hasAttribute('data-focus')).toBe(false);
  });

  it('не клавиша перехода (Enter) кольцо не возвращает', () => {
    fireEvent.pointerDown(document.body);
    renderDialog();
    fireEvent.keyDown(screen.getByText('Первая'), { key: 'Enter' });
    expect(screen.getByRole('dialog').getAttribute('data-focus')).toBe('quiet');
  });

  it('открыто с клавиатуры (Enter на кнопке): кольцо сразу', () => {
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    renderDialog();
    expect(screen.getByRole('dialog').hasAttribute('data-focus')).toBe(false);
  });

  it('сочетание с Ctrl/Cmd — не ввод с клавиатуры: окно остаётся тихим', () => {
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    renderDialog();
    expect(screen.getByRole('dialog').getAttribute('data-focus')).toBe('quiet');
  });
});

