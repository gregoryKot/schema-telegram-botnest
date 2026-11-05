// @vitest-environment jsdom
// Под формой входа — оба пункта экрана согласий: кто видел этот текст, тому
// `useConsentGate` принимает согласие тихо, и второго шанса прочитать пункт
// «не клиническая диагностика» у него нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { LoginConsentNote } from './LoginConsentNote';

afterEach(cleanup);

function renderFor(form: 'ty' | 'vy') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <LoginConsentNote />
    </AddressFormContext.Provider>,
  );
  return screen.getByTestId('login-consent-note');
}

describe('LoginConsentNote', () => {
  it('несёт оба согласия: 18+ с данными и «не клиническая диагностика»', () => {
    const note = renderFor('ty');
    expect(note.textContent).toMatch(/18 лет/);
    expect(note.textContent).toMatch(/персональных данных/);
    expect(note.textContent).toMatch(/не ставят клинический диагноз/);
  });

  it('ведёт на политику конфиденциальности', () => {
    renderFor('ty');
    expect(screen.getByRole('link', { name: 'Политикой конфиденциальности' }).getAttribute('href')).toBe('/privacy');
  });

  it('звучит в обеих формах: в «вы» нет «ты»-форм', () => {
    expect(renderFor('ty').textContent).toMatch(/ты подтверждаешь/);
    cleanup();
    const vy = renderFor('vy').textContent ?? '';
    expect(vy).toMatch(/вы подтверждаете/);
    expect(hasTyForms(vy)).toBe(false);
  });
});
