// @vitest-environment jsdom
// Подсказка пустого холста: обе формы обращения (QA 2026-10-26: «Кликай по
// режиму…» висела человеку с формой «вы»). Телефонной подсказки нет: на телефоне
// холст не показывается вовсе (ModeMapTab).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CanvasEmpty } from './CanvasEmpty';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { paperSignName } from '../../test-support/paperSign';

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
  it('знак — круги режимов (Cluster), заголовок «Карта пуста» над подсказкой', () => {
    const { container } = renderAt(1200, 'ty');
    expect(paperSignName(container.querySelector('.mm2-canvas-empty .pp-empty svg'))).toBe('Cluster');
    expect(screen.getByText('Карта пуста').className).toBe('ds-list-title');
  });

  it('десктоп, «ты»: палитра слева, можно перетащить', () => {
    renderAt(1200, 'ty');
    expect(screen.getByText('Кликай по режиму в панели слева или перетащи его на холст')).toBeTruthy();
  });

  it('десктоп, «вы»: та же подсказка во множественном числе', () => {
    renderAt(1200, 'vy');
    expect(screen.getByText('Кликайте по режиму в панели слева или перетащите его на холст')).toBeTruthy();
  });

});
