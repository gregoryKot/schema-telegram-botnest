// @vitest-environment jsdom
// OnboardingOverlay — 3-шаговый онбординг трекера (0% покрытия). Проверяет:
// последний шаг меняет и текст, И поведение кнопки «Далее» на «Понятно,
// начнём» → dismissOnb (не setOnbStep) — перепутать легко при правке границы
// «< 2»; «Пропустить» всегда зовёт dismissOnb независимо от текущего шага.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { OnboardingOverlay } from './OnboardingOverlay';

afterEach(() => {
  cleanup();
});

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

describe('OnboardingOverlay — шаги 0 и 1 (промежуточные)', () => {
  it('шаг 0 — заголовок первого шага, кнопка «Далее →»', () => {
    render(
      <OnboardingOverlay
        onbStep={0}
        setOnbStep={vi.fn()}
        dismissOnb={vi.fn()}
      />,
    );
    expect(screen.getByText('Оценивай действия')).toBeTruthy();
    expect(screen.getByText('Далее →')).toBeTruthy();
  });

  it('клик «Далее →» на шаге 0 продвигает onbStep на 1', () => {
    const setOnbStep = vi.fn();
    render(
      <OnboardingOverlay
        onbStep={0}
        setOnbStep={setOnbStep}
        dismissOnb={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Далее →'));
    const updater = setOnbStep.mock.calls[0][0] as (s: number) => number;
    expect(updater(0)).toBe(1);
  });

  it('шаг 1 — заголовок второго шага', () => {
    render(
      <OnboardingOverlay
        onbStep={1}
        setOnbStep={vi.fn()}
        dismissOnb={vi.fn()}
      />,
    );
    expect(screen.getByText('Нажми на название')).toBeTruthy();
  });
});

describe('OnboardingOverlay — последний шаг (2)', () => {
  it('кнопка меняется на «Понятно, начнём»', () => {
    render(
      <OnboardingOverlay
        onbStep={2}
        setOnbStep={vi.fn()}
        dismissOnb={vi.fn()}
      />,
    );
    expect(screen.getByText('Понятно, начнём')).toBeTruthy();
    expect(screen.queryByText('Далее →')).toBeNull();
  });

  it('клик по «Понятно, начнём» зовёт dismissOnb, НЕ setOnbStep', () => {
    const dismissOnb = vi.fn();
    const setOnbStep = vi.fn();
    render(
      <OnboardingOverlay
        onbStep={2}
        setOnbStep={setOnbStep}
        dismissOnb={dismissOnb}
      />,
    );
    fireEvent.click(screen.getByText('Понятно, начнём'));
    expect(dismissOnb).toHaveBeenCalled();
    expect(setOnbStep).not.toHaveBeenCalled();
  });
});

describe('OnboardingOverlay — «Пропустить»', () => {
  it('на любом шаге зовёт dismissOnb', () => {
    const dismissOnb = vi.fn();
    render(
      <OnboardingOverlay
        onbStep={0}
        setOnbStep={vi.fn()}
        dismissOnb={dismissOnb}
      />,
    );
    fireEvent.click(screen.getByText('Пропустить'));
    expect(dismissOnb).toHaveBeenCalled();
  });
});

describe('OnboardingOverlay — ты/вы', () => {
  it('форма «ты»: заголовки первых двух шагов на «ты»', () => {
    renderWithForm(
      <OnboardingOverlay
        onbStep={0}
        setOnbStep={vi.fn()}
        dismissOnb={vi.fn()}
      />,
      'ty',
    );
    expect(screen.getByText('Оценивай действия')).toBeTruthy();
  });

  it('форма «вы»: заголовок шага 0 согласован, без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <OnboardingOverlay
        onbStep={0}
        setOnbStep={vi.fn()}
        dismissOnb={vi.fn()}
      />,
      'vy',
    );
    expect(screen.getByText('Оценивайте действия')).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });

  it('форма «вы»: шаг 1 тоже согласован', () => {
    renderWithForm(
      <OnboardingOverlay
        onbStep={1}
        setOnbStep={vi.fn()}
        dismissOnb={vi.fn()}
      />,
      'vy',
    );
    expect(screen.getByText('Нажмите на название')).toBeTruthy();
  });
});
