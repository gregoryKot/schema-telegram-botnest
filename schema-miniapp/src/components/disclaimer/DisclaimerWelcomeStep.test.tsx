// @vitest-environment jsdom
// DisclaimerWelcomeStep — единственный оставшийся содержательный шаг визарда
// после свода 2026-08-31 (steps.ts). Вторая карточка раньше перечисляла
// каталог инструментов — теперь описывает путь входа («начать можно с одного
// случая»). Строка безличная (без вилки ты/вы) — проверяем общим свипом
// hasTyForms, как раньше делал удалённый DisclaimerContentSteps.test.tsx.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { DisclaimerWelcomeStep } from './DisclaimerWelcomeStep';

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
  it('форма «ты»: приветствие и путь входа на месте', () => {
    renderWithForm(<DisclaimerWelcomeStep />, 'ty');
    expect(screen.getByText(/Хорошо, что ты здесь/)).toBeTruthy();
    expect(screen.getByText('Всё по схеме')).toBeTruthy();
    expect(screen.getByText('БЕТА-ВЕРСИЯ')).toBeTruthy();
    // Вторая карточка больше не перечисляет каталог инструментов — описывает
    // путь: один случай → три минуты → видно, какая часть вышла вперёд.
    expect(screen.getByText(/Начать можно с одного случая/)).toBeTruthy();
    expect(
      screen.getByText(/Дневники, трекер и практики открываются оттуда же/),
    ).toBeTruthy();
  });

  it('форма «вы»: приветствие на «вы», путь входа безличный — ни одной «ты»-формы', () => {
    const { container } = renderWithForm(<DisclaimerWelcomeStep />, 'vy');
    expect(screen.getByText(/Хорошо, что вы здесь/)).toBeTruthy();
    expect(screen.getByText(/Начать можно с одного случая/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
