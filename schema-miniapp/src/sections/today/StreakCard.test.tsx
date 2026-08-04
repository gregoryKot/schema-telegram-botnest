// @vitest-environment jsdom
// StreakCard экрана «Сегодня» — плюрализация дней (день/дня/дней) и обе формы
// обращения (правило ты/вы CLAUDE.md); проверяем грep-свипом, что в «вы»-режиме
// не протекает ни одной «ты»-формы (используется в TodaySection.tsx).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { StreakCard } from './StreakCard';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('StreakCard — плюрализация дней', () => {
  it('1 день — единственное число', () => {
    renderWithForm(<StreakCard streak={1} />, 'ty');
    expect(screen.getByText('1 день подряд')).toBeTruthy();
  });

  it('3 дня — форма "дня"', () => {
    renderWithForm(<StreakCard streak={3} />, 'ty');
    expect(screen.getByText('3 дня подряд')).toBeTruthy();
  });

  it('7 дней — форма "дней"', () => {
    renderWithForm(<StreakCard streak={7} />, 'ty');
    expect(screen.getByText('7 дней подряд')).toBeTruthy();
  });
});

describe('StreakCard — обращение ты/вы', () => {
  it('форма «ты»', () => {
    renderWithForm(<StreakCard streak={2} />, 'ty');
    expect(
      screen.getByText('сбиться — не страшно, просто продолжай'),
    ).toBeTruthy();
  });

  it('форма «вы» — согласованное окончание, без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(<StreakCard streak={2} />, 'vy');
    expect(
      screen.getByText('сбиться — не страшно, просто продолжайте'),
    ).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
