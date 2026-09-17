// @vitest-environment jsdom
// Инфраструктура ты/вы (правило CLAUDE.md «Обращение ты/вы») жила копией в
// обоих фронтендах — сведена в shared. Тест держит контракт: дефолт «ты»
// (в т.ч. при null-форме), живое переключение через контекст, чистый pickForm.
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  AddressFormContext,
  useAddressForm,
  useTr,
  pickForm,
  type AddressForm,
} from './addressForm';

const wrap =
  (form: AddressForm) =>
  ({ children }: { children: ReactNode }) => (
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {children}
    </AddressFormContext.Provider>
  );

describe('useTr / useAddressForm', () => {
  it('без провайдера — дефолт «ты»', () => {
    const { result } = renderHook(() => useTr());
    expect(result.current('привет тебе', 'привет вам')).toBe('привет тебе');
  });

  it('форма «вы» из контекста — vy-вариант', () => {
    const { result } = renderHook(() => useTr(), { wrapper: wrap('vy') });
    expect(result.current('твой день', 'ваш день')).toBe('ваш день');
  });

  it('useAddressForm отдаёт форму из контекста', () => {
    const { result } = renderHook(() => useAddressForm(), {
      wrapper: wrap('vy'),
    });
    expect(result.current).toBe('vy');
  });
});

describe('pickForm (не-React места)', () => {
  it('vy → вы-вариант; ty/null/undefined → ты-вариант (дефолт)', () => {
    expect(pickForm('vy', 'ты', 'вы')).toBe('вы');
    expect(pickForm('ty', 'ты', 'вы')).toBe('ты');
    expect(pickForm(null, 'ты', 'вы')).toBe('ты');
    expect(pickForm(undefined, 'ты', 'вы')).toBe('ты');
  });
});
