// @vitest-environment jsdom
// Дисклеймер «инструмент — не терапия» жил копией в обоих фронтендах и
// разошёлся дважды: мини отстал от «отказа от эмодзи» (💬), webapp — от
// типографики VOICE (дефис вместо —). Сведён в shared; тест держит ветки:
// compact/полный, терапевт/клиент, ты/вы, и регрессию «эмодзи больше нет».
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { TherapyNote } from './TherapyNote';
import type { ReactElement } from 'react';

const contactMock = vi.hoisted(() => ({
  current: {
    name: 'автору',
    url: 'https://t.me/x',
    isTherapist: false,
  },
}));
vi.mock('../utils/therapistContact', () => ({
  getTherapistContact: () => contactMock.current,
}));

const withForm = (ui: ReactElement, form: AddressForm = 'ty') =>
  render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );

beforeEach(() => {
  contactMock.current = {
    name: 'автору',
    url: 'https://t.me/x',
    isTherapist: false,
  };
});
afterEach(() => cleanup());

describe('TherapyNote', () => {
  it('полный вид, клиент: дисклеймер + «Поговорить с психологом», без эмодзи', () => {
    const { container } = withForm(<TherapyNote />);
    expect(container.textContent).toContain('инструмент самоисследования');
    expect(container.textContent).toContain('Поговорить с психологом');
    expect(container.textContent).not.toContain('💬');
  });

  it('компакт, клиент: короткая строка и ссылка «Записаться»', () => {
    const { container } = withForm(<TherapyNote compact />);
    expect(container.textContent).toContain('не замена психологу');
    expect(container.textContent).toContain('Записаться');
  });

  it('терапевт: «вы»-форма согласована, ссылки на запись нет', () => {
    contactMock.current.isTherapist = true;
    const { container } = withForm(<TherapyNote compact />, 'vy');
    expect(container.textContent).toContain('Вы работаете как терапевт');
    expect(container.querySelector('a')).toBeNull();
  });

  it('именованный специалист: «Написать <имя>»', () => {
    contactMock.current.name = 'Марии';
    const { container } = withForm(<TherapyNote />);
    expect(container.textContent).toContain('Написать Марии');
  });
});
