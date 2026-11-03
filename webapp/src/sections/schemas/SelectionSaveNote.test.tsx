// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { SelectionSaveNote } from './SelectionSaveNote';

afterEach(cleanup);

function renderNote(failed: boolean, blocked: boolean, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <SelectionSaveNote failed={failed} blocked={blocked} />
    </AddressFormContext.Provider>,
  );
}

describe('SelectionSaveNote', () => {
  it('сохранение не падало — плашки нет', () => {
    renderNote(false, false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('обычный сбой — «проверь связь»', () => {
    renderNote(true, false);
    expect(screen.getByRole('alert').textContent).toMatch(/проверь связь и попробуй ещё раз/);
  });

  it('409 «не читается» — свой текст, без «проверь связь»; «ты»', () => {
    renderNote(true, true);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toMatch(/прежний список сейчас не читается/);
    expect(text).toMatch(/попробуй ещё раз позже$/);
    expect(text).not.toMatch(/проверь связь/);
  });

  it('409 «не читается» — форма «вы»', () => {
    renderNote(true, true, 'vy');
    expect(screen.getByRole('alert').textContent).toMatch(/попробуйте ещё раз позже$/);
  });
});
