// @vitest-environment jsdom
// Согласие на ПДн — отдельная галочка, не отмеченная по умолчанию; строка под кнопками
// несёт 18+ и «не диагноз» и ведёт на политику, но согласием не является.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { LoginConsentCheck, LoginConsentNote } from './LoginConsentNote';

afterEach(cleanup);

function renderFor(form: 'ty' | 'vy', checked = false, onChange = vi.fn()) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <LoginConsentCheck checked={checked} onChange={onChange} />
      <LoginConsentNote />
    </AddressFormContext.Provider>,
  );
}

describe('согласие на входе сайта', () => {
  it('галочка не отмечена, подсказка видна, «Даю согласие» ведёт на /consent', () => {
    const onChange = vi.fn();
    renderFor('ty', false, onChange);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText('Чтобы войти, отметь согласие')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Даю согласие' }).getAttribute('href')).toBe('/consent');
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('отмеченная галочка убирает подсказку', () => {
    renderFor('ty', true);
    expect(screen.queryByText(/Чтобы войти/)).toBeNull();
  });

  it('под кнопками: 18+, «не диагноз» и ссылка на политику; согласия на ПДн в этой строке нет', () => {
    renderFor('ty');
    const note = screen.getByTestId('login-consent-note');
    expect(note.textContent).toMatch(/18 лет/);
    expect(note.textContent).toMatch(/не ставит диагноз/);
    expect(note.textContent).not.toMatch(/согласие/i);
    expect(screen.getByRole('link', { name: 'Политика конфиденциальности' }).getAttribute('href')).toBe('/privacy');
  });

  it('обе формы: в «вы» нет «ты»-форм', () => {
    expect(renderFor('ty').container.textContent).toMatch(/ты подтверждаешь/);
    cleanup();
    const vy = renderFor('vy').container.textContent ?? '';
    expect(vy).toMatch(/Чтобы войти, отметьте согласие/);
    expect(vy).toMatch(/вы подтверждаете/);
    expect(hasTyForms(vy)).toBe(false);
  });
});
