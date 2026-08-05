// @vitest-environment jsdom
// Содержательные шаги онбординга без интерактивного состояния
// (DisclaimerWelcomeStep, DisclaimerNeedsResultStep, DisclaimerNeedsWhyStep,
// DisclaimerDiariesWhyStep, DisclaimerTodayScreenStep) — все были на 0%
// покрытия. Каждый использует useTr(): проверяем, что в форме «вы» не
// остаётся ни одной «ты»-формы (правило CLAUDE.md про обращение) через
// общий свип hasTyForms, а не ручной перебор конкретных слов.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { DisclaimerWelcomeStep } from './DisclaimerWelcomeStep';
import { DisclaimerNeedsResultStep } from './DisclaimerNeedsResultStep';
import { DisclaimerNeedsWhyStep } from './DisclaimerNeedsWhyStep';
import { DisclaimerDiariesWhyStep } from './DisclaimerDiariesWhyStep';
import { DisclaimerTodayScreenStep } from './DisclaimerTodayScreenStep';
import { FOCUS_OPTIONS } from '../../utils/todayFocus';

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

describe('DisclaimerWelcomeStep', () => {
  it('форма «ты»: приветствие звучит на «ты»', () => {
    renderWithForm(<DisclaimerWelcomeStep />, 'ty');
    expect(screen.getByText(/Хорошо, что ты здесь/)).toBeTruthy();
    expect(screen.getByText('Всё по схеме')).toBeTruthy();
    expect(screen.getByText('БЕТА-ВЕРСИЯ')).toBeTruthy();
  });

  it('форма «вы»: ни одной «ты»-формы в тексте', () => {
    const { container } = renderWithForm(<DisclaimerWelcomeStep />, 'vy');
    expect(screen.getByText(/Хорошо, что вы здесь/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});

describe('DisclaimerNeedsResultStep', () => {
  it('форма «ты»: заголовок «Что ты увидишь»', () => {
    renderWithForm(<DisclaimerNeedsResultStep />, 'ty');
    expect(screen.getByText('Что ты увидишь')).toBeTruthy();
  });

  it('форма «вы»: заголовок «Что вы увидите», без «ты»-форм', () => {
    const { container } = renderWithForm(<DisclaimerNeedsResultStep />, 'vy');
    expect(screen.getByText('Что вы увидите')).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});

describe('DisclaimerNeedsWhyStep', () => {
  it('форма «ты»: содержит обращение «Ты отмечаешь»', () => {
    renderWithForm(<DisclaimerNeedsWhyStep />, 'ty');
    expect(screen.getByText(/Ты отмечаешь не фоновое настроение/)).toBeTruthy();
    // Общий чип времени переиспользован, а не задублирован инлайн.
    expect(screen.getByText('⏱')).toBeTruthy();
  });

  it('форма «вы»: без «ты»-форм', () => {
    const { container } = renderWithForm(<DisclaimerNeedsWhyStep />, 'vy');
    expect(screen.getByText(/Вы отмечаете не фоновое настроение/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});

describe('DisclaimerDiariesWhyStep', () => {
  it('форма «ты»: рендерит обе карточки (схема/режим) и чип с подводкой', () => {
    renderWithForm(<DisclaimerDiariesWhyStep />, 'ty');
    expect(screen.getByText('Дневники схем и режимов')).toBeTruthy();
    expect(screen.getByText(/чего тебе на самом деле не хватает/)).toBeTruthy();
  });

  it('форма «вы»: без «ты»-форм в тексте чипа', () => {
    const { container } = renderWithForm(<DisclaimerDiariesWhyStep />, 'vy');
    expect(screen.getByText(/чего вам на самом деле не хватает/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});

describe('DisclaimerTodayScreenStep', () => {
  it('рендерит все опции FOCUS_OPTIONS (один источник с листом «Настроить экран»)', () => {
    renderWithForm(<DisclaimerTodayScreenStep />, 'ty');
    for (const o of FOCUS_OPTIONS) {
      expect(screen.getByText(o.label)).toBeTruthy();
    }
    expect(screen.getByText('Главный экран — под тебя')).toBeTruthy();
  });

  it('форма «вы»: заголовок и подсказка про долгое нажатие без «ты»-форм', () => {
    const { container } = renderWithForm(<DisclaimerTodayScreenStep />, 'vy');
    expect(screen.getByText('Главный экран — под вас')).toBeTruthy();
    expect(screen.getByText(/задержите палец/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
