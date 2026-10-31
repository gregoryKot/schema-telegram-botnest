// @vitest-environment jsdom
// Подсказка пустого холста: обе формы обращения и телефон без «панели слева»
// (QA 2026-10-26: «Кликай по режиму…» висела человеку с формой «вы», а на
// телефоне палитра открывается кнопкой, панели слева там нет).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CanvasEmpty } from './CanvasEmpty';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';

function renderAt(width: number, form: AddressForm) {
  window.innerWidth = width;
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      <CanvasEmpty />
    </AddressFormContext.Provider>,
  );
}

afterEach(() => cleanup());

describe('CanvasEmpty', () => {
  it('десктоп, «ты»: палитра слева, можно перетащить', () => {
    renderAt(1200, 'ty');
    expect(screen.getByText('Кликай по режиму в панели слева или перетащи его на холст')).toBeTruthy();
  });

  it('десктоп, «вы»: та же подсказка во множественном числе', () => {
    renderAt(1200, 'vy');
    expect(screen.getByText('Кликайте по режиму в панели слева или перетащите его на холст')).toBeTruthy();
  });

  it('телефон: про кнопку списка режимов, без «панели слева»', () => {
    renderAt(390, 'vy');
    expect(screen.getByText('Откройте список режимов кнопкой › слева вверху и нажмите на режим')).toBeTruthy();
    expect(screen.queryByText(/в панели слева/)).toBeNull();
  });
});
