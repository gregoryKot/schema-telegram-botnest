// @vitest-environment jsdom
// Тесты ключевой инфраструктуры ты/вы (CLAUDE.md, TEST_COVERAGE_PLAN этап 2 п.10).
// addressForm.tsx — парный файл (schema-miniapp/src/utils/addressForm.tsx,
// проверяется scripts/check-paired-files.mjs) — сам файл здесь не меняется.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  useAddressForm,
  useSetAddressForm,
  useTr,
  pickForm,
} from './addressForm';
import { AddressFormProvider } from './AddressFormProvider';

// ── Mock api: провайдер грузит настройки через api.getSettings() ─────────────
vi.mock('../api', () => ({
  api: { getSettings: vi.fn() },
}));

import { api } from '../api';
const mockApi = api as unknown as { getSettings: ReturnType<typeof vi.fn> };

function wrapper({ children }: { children: ReactNode }) {
  return <AddressFormProvider>{children}</AddressFormProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // По умолчанию — настройки ещё не пришли (провайдер сам решает не менять форму).
  mockApi.getSettings.mockResolvedValue({});
});

// ── pickForm: чистый селектор для не-React мест ───────────────────────────────
describe('pickForm', () => {
  it("'ty' -> ты-вариант", () => {
    expect(pickForm('ty', 'привет', 'здравствуйте')).toBe('привет');
  });

  it("'vy' -> вы-вариант", () => {
    expect(pickForm('vy', 'привет', 'здравствуйте')).toBe('здравствуйте');
  });

  it('null -> дефолт «ты» (CLAUDE.md: addressForm=null до первого выбора = «ты»)', () => {
    expect(pickForm(null, 'привет', 'здравствуйте')).toBe('привет');
  });

  it('undefined -> тоже дефолт «ты»', () => {
    expect(pickForm(undefined, 'привет', 'здравствуйте')).toBe('привет');
  });
});

// ── useTr / useAddressForm без провайдера ─────────────────────────────────────
describe('useAddressForm/useTr без AddressFormProvider', () => {
  it('useAddressForm возвращает дефолт контекста «ty» (без обёртки провайдером)', () => {
    const { result } = renderHook(() => useAddressForm());
    expect(result.current).toBe('ty');
  });

  it('useTr без провайдера резолвит в ты-вариант (дефолт контекста form=ty)', () => {
    const { result } = renderHook(() => useTr());
    expect(result.current('привет', 'здравствуйте')).toBe('привет');
  });

  it('useSetAddressForm без провайдера возвращает no-op из дефолта контекста', () => {
    const { result } = renderHook(() => useSetAddressForm());
    // Дефолтный setForm в createContext — пустая функция; не должна падать.
    expect(() => result.current('vy')).not.toThrow();
  });
});

// ── Внутри провайдера: начальное состояние и подгрузка настроек ──────────────
describe('AddressFormProvider — начальное состояние и загрузка', () => {
  it('до ответа api форма — «ty» (стартовый useState)', () => {
    // getSettings ещё не резолвился — читаем состояние синхронно сразу после рендера.
    mockApi.getSettings.mockReturnValue(new Promise(() => {})); // никогда не резолвится
    const { result } = renderHook(() => useAddressForm(), { wrapper });
    expect(result.current).toBe('ty');
  });

  it('после успешной загрузки settings.addressForm=\'vy\' форма переключается на «вы»', async () => {
    mockApi.getSettings.mockResolvedValue({ addressForm: 'vy' });
    const { result } = renderHook(() => useAddressForm(), { wrapper });

    await waitFor(() => expect(result.current).toBe('vy'));
  });

  it('addressForm=null из settings оставляет форму «ty» (дефолт)', async () => {
    mockApi.getSettings.mockResolvedValue({ addressForm: null });
    const { result } = renderHook(() => useAddressForm(), { wrapper });

    await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled());
    expect(result.current).toBe('ty');
  });

  it('невалидное значение addressForm игнорируется, форма остаётся «ty»', async () => {
    mockApi.getSettings.mockResolvedValue({ addressForm: 'garbage' });
    const { result } = renderHook(() => useAddressForm(), { wrapper });

    await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled());
    expect(result.current).toBe('ty');
  });

  it('ошибка api.getSettings не роняет провайдер, форма остаётся «ty»', async () => {
    mockApi.getSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAddressForm(), { wrapper });

    await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled());
    expect(result.current).toBe('ty');
  });
});

// ── useTr внутри провайдера отражает текущую форму ────────────────────────────
describe('useTr внутри AddressFormProvider', () => {
  it('форма «ty» -> useTr резолвит ты-вариант', () => {
    mockApi.getSettings.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTr(), { wrapper });
    expect(result.current('привет', 'здравствуйте')).toBe('привет');
  });

  it('после загрузки vy из settings useTr резолвит вы-вариант', async () => {
    mockApi.getSettings.mockResolvedValue({ addressForm: 'vy' });
    const { result } = renderHook(() => useTr(), { wrapper });

    await waitFor(() =>
      expect(result.current('привет', 'здравствуйте')).toBe('здравствуйте'),
    );
  });
});

// ── useSetAddressForm: живое переключение без перезагрузки ───────────────────
describe('useSetAddressForm — живое обновление тона', () => {
  function useCombined() {
    return { form: useAddressForm(), setForm: useSetAddressForm(), tr: useTr() };
  }

  it('setForm(\'vy\') сразу переключает useAddressForm и useTr на «вы»', async () => {
    const { result } = renderHook(() => useCombined(), { wrapper });
    // Дожидаемся первичной подгрузки настроек (дефолт ty, settings пустые).
    await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled());
    expect(result.current.form).toBe('ty');

    act(() => { result.current.setForm('vy'); });

    expect(result.current.form).toBe('vy');
    expect(result.current.tr('привет', 'здравствуйте')).toBe('здравствуйте');
  });

  it('setForm(\'ty\') возвращает форму «ты» обратно', async () => {
    mockApi.getSettings.mockResolvedValue({ addressForm: 'vy' });
    const { result } = renderHook(() => useCombined(), { wrapper });
    await waitFor(() => expect(result.current.form).toBe('vy'));

    act(() => { result.current.setForm('ty'); });

    expect(result.current.form).toBe('ty');
    expect(result.current.tr('привет', 'здравствуйте')).toBe('привет');
  });

  it('setForm — только in-memory: провайдер не пишет в localStorage сам по себе', async () => {
    const { result } = renderHook(() => useCombined(), { wrapper });
    await waitFor(() => expect(mockApi.getSettings).toHaveBeenCalled());

    act(() => { result.current.setForm('vy'); });

    // Персист формы — забота вызывающего кода (сохранение в settings через api),
    // сам AddressFormProvider localStorage не трогает.
    expect(localStorage.getItem('addressForm')).toBeNull();
  });
});
