// @vitest-environment jsdom
// Регрессия: выбор «вы» молча не долетал до сервера — оба пикера глушили
// провал api.updateSettings и закрывали диалог как успешный (см. комментарий
// в useAddressFormChoice.ts). Здесь — сама логика решения «сохранилось ли»,
// без вёрстки конкретного пикера.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  ADDRESS_FORM_SAVE_SECTION,
  useAddressFormChoice,
} from './useAddressFormChoice';

describe('useAddressFormChoice', () => {
  it('успех: setForm и onSaved вызваны, failed остаётся false, report не зовётся', async () => {
    const setForm = vi.fn();
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const report = vi.fn();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useAddressFormChoice(setForm, updateSettings, report, onSaved),
    );

    await act(async () => result.current.choose('vy'));

    expect(setForm).toHaveBeenCalledWith('vy');
    expect(updateSettings).toHaveBeenCalledWith({ addressForm: 'vy' });
    expect(onSaved).toHaveBeenCalledWith('vy');
    expect(report).not.toHaveBeenCalled();
    expect(result.current.failed).toBe(false);
  });

  it('отказ: setForm всё равно вызван (интерфейс уже переключился), но onSaved — нет, failed=true, report ушёл в секцию addressForm', async () => {
    const setForm = vi.fn();
    const updateSettings = vi.fn().mockRejectedValue(new Error('network'));
    const report = vi.fn();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useAddressFormChoice(setForm, updateSettings, report, onSaved),
    );

    await act(async () => result.current.choose('vy'));

    expect(setForm).toHaveBeenCalledWith('vy');
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.failed).toBe(true);
    expect(report).toHaveBeenCalledWith({
      section: ADDRESS_FORM_SAVE_SECTION,
      message: 'address form save failed',
    });
  });

  it('повторный вызов choose после отказа — новая попытка сбрасывает failed на время запроса и повторяет запись', async () => {
    const setForm = vi.fn();
    const updateSettings = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const report = vi.fn();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useAddressFormChoice(setForm, updateSettings, report, onSaved),
    );

    await act(async () => result.current.choose('vy'));
    expect(result.current.failed).toBe(true);

    await act(async () => result.current.choose('vy'));
    expect(result.current.failed).toBe(false);
    expect(onSaved).toHaveBeenCalledWith('vy');
    expect(updateSettings).toHaveBeenCalledTimes(2);
  });

  it('ADDRESS_FORM_SAVE_SECTION — постоянная строка (реестр src/api/client-error-section.ts)', () => {
    expect(ADDRESS_FORM_SAVE_SECTION).toBe('addressForm');
  });
});
