// @vitest-environment jsdom
// Регрессия: вы-пользователь видел вспышку дефолтной формы при каждом входе,
// потому что провайдер стартовал с 'ty' и узнавал форму только после async
// getSettings. Кэш в localStorage даёт синхронный старт в правильной форме.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  readCachedForm,
  cacheForm,
  useAddressFormValue,
} from './addressFormCache';

describe('addressFormCache', () => {
  beforeEach(() => localStorage.clear());

  it('пустой кэш → «ты» по умолчанию', () => {
    expect(readCachedForm()).toBe('ty');
  });

  it('round-trip: «вы» ↔ «ты»', () => {
    cacheForm('vy');
    expect(readCachedForm()).toBe('vy');
    cacheForm('ty');
    expect(readCachedForm()).toBe('ty');
  });

  it('мусор в кэше трактуется как «ты» (безопасный дефолт)', () => {
    localStorage.setItem('address_form', 'garbage');
    expect(readCachedForm()).toBe('ty');
  });
});

describe('useAddressFormValue', () => {
  beforeEach(() => localStorage.clear());

  it('стартует СРАЗУ из кэша — без вспышки дефолтной формы', () => {
    cacheForm('vy');
    // loadForm ещё висит: если бы старт был из дефолта, тут было бы 'ty'.
    const { result } = renderHook(() =>
      useAddressFormValue(() => new Promise<'ty' | 'vy'>(() => {})),
    );
    expect(result.current[0]).toBe('vy');
  });

  it('перезаписывается значением из loadForm (сервер — источник правды)', async () => {
    cacheForm('vy');
    const { result } = renderHook(() =>
      useAddressFormValue(() => Promise.resolve('ty' as const)),
    );
    await waitFor(() => expect(result.current[0]).toBe('ty'));
  });

  it('null/ошибка loadForm не сбрасывают форму из кэша', async () => {
    cacheForm('vy');
    const { result } = renderHook(() =>
      useAddressFormValue(() => Promise.resolve(null)),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current[0]).toBe('vy');
  });

  it('setForm пишет кэш и обновляет форму', () => {
    const { result } = renderHook(() =>
      useAddressFormValue(() => new Promise<'ty' | 'vy'>(() => {})),
    );
    act(() => result.current[1]('vy'));
    expect(result.current[0]).toBe('vy');
    expect(readCachedForm()).toBe('vy');
  });
});
