// @vitest-environment jsdom
// Тост «Доступна новая версия» (docs/PWA_PLAN.md фаза 1): молчит, пока
// обновления нет; показывается по сигналу onUpdateAvailable; кнопка зовёт
// applyUpdate; вилка ты/вы реально меняет текст (правило CLAUDE.md).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';

type UpdateListener = () => void;
let listener: UpdateListener | null = null;
const applyUpdateMock = vi.fn();

vi.mock('../registerServiceWorker', () => ({
  onUpdateAvailable: (cb: UpdateListener) => {
    listener = cb;
    return () => {
      listener = null;
    };
  },
  applyUpdate: () => applyUpdateMock(),
}));

const { UpdateToast } = await import('./UpdateToast');

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

// setState вызывается вне React-события (напрямую из «сервиса» через
// подписку) — без act() обновление не гарантированно долетит до DOM к
// моменту проверки (см. BreathingCard.test.tsx — тот же приём).
function fireUpdateAvailable() {
  act(() => {
    listener?.();
  });
}

afterEach(() => {
  cleanup();
  applyUpdateMock.mockClear();
  listener = null;
});

describe('UpdateToast', () => {
  it('пока обновления нет — ничего не рендерит', () => {
    const { container } = renderWithForm(<UpdateToast />, 'ty');
    expect(container.textContent).toBe('');
  });

  it('после сигнала onUpdateAvailable — показывает тост', () => {
    const { container } = renderWithForm(<UpdateToast />, 'ty');
    expect(listener).not.toBeNull();
    fireUpdateAvailable();
    expect(container.textContent).toContain('новая версия');
  });

  it('форма «вы»: без «ты»-форм', () => {
    const { container } = renderWithForm(<UpdateToast />, 'vy');
    fireUpdateAvailable();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });

  it('вилка ты/вы меняет текст кнопки', () => {
    const ty = renderWithForm(<UpdateToast />, 'ty');
    fireUpdateAvailable();
    const tyText = ty.container.textContent;
    cleanup();

    const vy = renderWithForm(<UpdateToast />, 'vy');
    fireUpdateAvailable();
    const vyText = vy.container.textContent;

    expect(tyText).not.toEqual(vyText);
  });

  it('кнопка «Обнови» зовёт applyUpdate', () => {
    const { getByText } = renderWithForm(<UpdateToast />, 'ty');
    fireUpdateAvailable();
    fireEvent.click(getByText('Обнови'));
    expect(applyUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('крестик скрывает тост без вызова applyUpdate', () => {
    const { container, getByLabelText } = renderWithForm(<UpdateToast />, 'ty');
    fireUpdateAvailable();
    fireEvent.click(getByLabelText('Скрыть'));
    expect(container.textContent).toBe('');
    expect(applyUpdateMock).not.toHaveBeenCalled();
  });
});
