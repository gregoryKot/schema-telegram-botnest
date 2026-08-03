// @vitest-environment jsdom
// Настройки: форма обращения (CLAUDE.md — правило «ты/вы», приоритет
// покрытия «настройки: форма обращения»). Поведение: клик по варианту
// вызывает и локальный setAddressForm (мгновенный тон), и patch (сохранение
// на бэке) с правильным аргументом; активный вариант подсвечен.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormSection } from './AddressFormSection';
import type { UserSettings } from '../../api';

afterEach(() => {
  cleanup();
});

function baseSettings(addressForm: 'ty' | 'vy' | null): UserSettings {
  return { addressForm } as UserSettings;
}

describe('AddressFormSection', () => {
  it('клик по «На «вы»»» вызывает setAddressForm и patch с form=vy', () => {
    const setAddressForm = vi.fn();
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <AddressFormSection
        settings={baseSettings('ty')}
        patch={patch}
        setAddressForm={setAddressForm}
      />,
    );

    fireEvent.click(screen.getByText('На «вы»'));

    expect(setAddressForm).toHaveBeenCalledWith('vy');
    expect(patch).toHaveBeenCalledWith({ addressForm: 'vy' });
  });

  it('клик по «На «ты»»» вызывает setAddressForm и patch с form=ty', () => {
    const setAddressForm = vi.fn();
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <AddressFormSection
        settings={baseSettings('vy')}
        patch={patch}
        setAddressForm={setAddressForm}
      />,
    );

    fireEvent.click(screen.getByText('На «ты»'));

    expect(setAddressForm).toHaveBeenCalledWith('ty');
    expect(patch).toHaveBeenCalledWith({ addressForm: 'ty' });
  });

  it('Enter на активном варианте тоже сохраняет (клавиатурный доступ)', () => {
    const setAddressForm = vi.fn();
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <AddressFormSection
        settings={baseSettings('ty')}
        patch={patch}
        setAddressForm={setAddressForm}
      />,
    );

    fireEvent.keyDown(screen.getByText('На «вы»'), { key: 'Enter' });

    expect(setAddressForm).toHaveBeenCalledWith('vy');
    expect(patch).toHaveBeenCalledWith({ addressForm: 'vy' });
  });

  it('addressForm=null (ещё не выбрано) — по умолчанию активен «ты»', () => {
    render(
      <AddressFormSection
        settings={baseSettings(null)}
        patch={vi.fn().mockResolvedValue(undefined)}
        setAddressForm={vi.fn()}
      />,
    );
    const tyOption = screen.getByText('На «ты»');
    expect(tyOption.style.color).toBe('rgb(255, 255, 255)');
    const vyOption = screen.getByText('На «вы»');
    expect(vyOption.style.color).not.toBe('rgb(255, 255, 255)');
  });
});
