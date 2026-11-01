// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { SelectionSaveNote } from './SelectionSaveNote';
import type { SaveErr } from './useMySelections';

afterEach(cleanup);

function renderNote(error: SaveErr, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      <SelectionSaveNote error={error} />
    </AddressFormContext.Provider>,
  );
}

describe('SelectionSaveNote', () => {
  it('ошибки нет — ничего не рисует', () => {
    const { container } = renderNote(null);
    expect(container.textContent).toBe('');
  });

  it('обычный сбой — «попробуй ещё раз»', () => {
    const { container } = renderNote('failed');
    expect(container.textContent).toMatch(/Не удалось сохранить выбор/);
    expect(container.textContent).toMatch(/попробуй ещё раз\.$/);
  });

  it('409 «не читается» — свой текст; «ты»', () => {
    const { container } = renderNote('blocked');
    expect(container.textContent).toMatch(/прежний список сейчас не читается/);
    expect(container.textContent).toMatch(/попробуй ещё раз позже$/);
    expect(container.textContent).not.toMatch(/Не удалось сохранить выбор/);
  });

  it('409 «не читается» — форма «вы»', () => {
    renderNote('blocked', 'vy');
    expect(screen.getByText(/попробуйте ещё раз позже$/)).toBeTruthy();
  });
});
