// @vitest-environment jsdom
// NeedsTab — вкладка «Потребности» в справочнике SchemaInfoSheet. Смоук на
// содержимое (откуда это — «схема-терапия», правило онбординга) и обе формы
// обращения (правило ты/вы), без остаточных «ты»-форм в «вы»-режиме.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { NeedsTab } from './NeedsTab';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('NeedsTab', () => {
  it('называет источник — схема-терапию (откуда это)', () => {
    renderWithForm(<NeedsTab />, 'ty');
    expect(screen.getByText(/схема-терапи/i)).toBeTruthy();
  });

  it('рендерит все пять базовых потребностей по заголовкам', () => {
    renderWithForm(<NeedsTab />, 'ty');
    for (const title of [
      'Привязанность',
      'Автономия',
      'Выражение чувств',
      'Спонтанность',
      'Границы',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('форма «ты»: местоимение 2 л. ед.ч. в описании привязанности', () => {
    renderWithForm(<NeedsTab />, 'ty');
    expect(screen.getByText(/чтобы тебя принимали/)).toBeTruthy();
  });

  it('форма «вы»: согласованное множественное число', () => {
    renderWithForm(<NeedsTab />, 'vy');
    expect(screen.getByText(/чтобы вас принимали/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм в тексте', () => {
    const { container } = renderWithForm(<NeedsTab />, 'vy');
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
