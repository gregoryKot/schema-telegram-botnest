// @vitest-environment jsdom
// App.tsx — начальная загрузка (продолжение App.dataload.test.tsx, разбито
// ради потолка 300 строк на файл): роль из getProfile решает вход в кабинет
// терапевта, реконсиляция запомненного режима с серверным флагом, вопрос
// «ты/вы» до онбординга, join по start_param хоста. Дочерние секции/оверлеи —
// заглушки (App.test-helpers.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import {
  renderApp,
  setUrl,
  mockUseUserFlags,
} from './test-support/App.test-helpers';
import {
  defaultFlags,
  unreadableFlags,
  mockProfile,
  mockSettings,
} from './test-support/App.test-fixtures';
import { api } from './api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mockUseUserFlags.mockReturnValue(defaultFlags());
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
});

describe('App — роль пользователя из getProfile решает вход в кабинет терапевта', () => {
  it('THERAPIST без запомненного режима (localStorage чист) остаётся на обычных секциях', async () => {
    mockApi.getProfile.mockResolvedValueOnce(
      mockProfile({ role: 'THERAPIST', name: 'Др. Кто' }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.userRole).toBe(
        'THERAPIST',
      ),
    );
    expect(screen.queryByTestId('therapist-client-sheet')).toBeNull();
  });

  it('серверный флаг therapistMode=true у THERAPIST реконсилируется в localStorage/UI после загрузки роли и флагов', async () => {
    mockUseUserFlags.mockReturnValue(defaultFlags({ therapistMode: true }));
    mockApi.getProfile.mockResolvedValueOnce(
      mockProfile({ role: 'THERAPIST', name: 'Др. Кто' }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy(),
    );
    expect(localStorage.getItem('therapist_mode')).toBe('1');
  });

  // Регресс 2026-08-21: дефолтные флаги (therapistMode=false) неотличимы от
  // серверных, и при неудачном запросе кабинет терапевта закрывался сам.
  it('флаги не прочитались с сервера — запомненный режим терапевта остаётся', async () => {
    localStorage.setItem('therapist_mode', '1');
    mockUseUserFlags.mockReturnValue(unreadableFlags());
    mockApi.getProfile.mockResolvedValueOnce(
      mockProfile({ role: 'THERAPIST', name: 'Др. Кто' }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('therapist-client-sheet')).toBeTruthy(),
    );
    expect(localStorage.getItem('therapist_mode')).toBe('1');
  });

  it('CLIENT-роль всегда сбрасывает терапевтический режим, даже если localStorage помнит другое', async () => {
    localStorage.setItem('therapist_mode', '1');
    mockApi.getProfile.mockResolvedValueOnce(
      mockProfile({ role: 'CLIENT', name: null }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-sections').dataset.userRole).toBe(
        'CLIENT',
      ),
    );
    expect(screen.queryByTestId('therapist-client-sheet')).toBeNull();
  });
});

describe('App — форма обращения: спрашивает ДО онбординга, если ещё не выбрана', () => {
  it('addressForm=null и вопрос не задавался в этой сессии → sheets.addressPicker открывается сам, без клика', async () => {
    mockApi.getSettings.mockResolvedValueOnce(
      mockSettings({ addressForm: null }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.addressPicker).toBe(
        'true',
      ),
    );
  });

  it('addressForm уже выбрана (не null) → addressPicker не открывается', async () => {
    mockApi.getSettings.mockResolvedValueOnce(
      mockSettings({ addressForm: 'vy' }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays')).toBeTruthy(),
    );
    expect(screen.getByTestId('app-overlays').dataset.addressPicker).toBe(
      'false',
    );
  });

  it('вопрос уже задавался недавно (снуз «Позже») → addressPicker не открывается повторно', async () => {
    // Регресс 2026-08-21: метка жила в sessionStorage и умирала со вкладкой,
    // поэтому вопрос возвращался при каждом открытии приложения.
    localStorage.setItem('addr_form_asked', String(Date.now()));
    mockApi.getSettings.mockResolvedValueOnce(
      mockSettings({ addressForm: null }),
    );
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays')).toBeTruthy(),
    );
    expect(screen.getByTestId('app-overlays').dataset.addressPicker).toBe(
      'false',
    );
  });
});

describe('App — start_param из хоста запускает присоединение к паре/терапии', () => {
  it('?startapp=diaries не роняет загрузку — приложение доходит до секций', async () => {
    setUrl('/?startapp=diaries');
    renderApp();
    // DiarySection рендерится внутри реального AppOverlays — здесь он
    // заглушен, поэтому судим по единственно доступному сигналу: приложение
    // не упало и продолжило загрузку до секций.
    await waitFor(() =>
      expect(screen.getByTestId('app-sections')).toBeTruthy(),
    );
  });

  it('?startapp=pair_ABC123 открывает экран-согласие, но НЕ джойнит молча (M1)', async () => {
    setUrl('/?startapp=pair_ABC123');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.joinConfirm).toBe(
        'true',
      ),
    );
    // Код и вид доехали до экрана согласия — джойн ждёт явного подтверждения.
    expect(screen.getByTestId('app-overlays').dataset.joinKind).toBe('pair');
    expect(screen.getByTestId('app-overlays').dataset.joinCode).toBe('ABC123');
    // Главное: без подтверждения приватного присоединения не произошло.
    expect(mockApi.joinPair).not.toHaveBeenCalled();
  });

  it('?startapp=therapy_XYZ открывает экран-согласие, но НЕ джойнит молча (M1)', async () => {
    setUrl('/?startapp=therapy_XYZ');
    renderApp();
    await waitFor(() =>
      expect(screen.getByTestId('app-overlays').dataset.joinConfirm).toBe(
        'true',
      ),
    );
    expect(screen.getByTestId('app-overlays').dataset.joinKind).toBe('therapy');
    expect(screen.getByTestId('app-overlays').dataset.joinCode).toBe('XYZ');
    expect(mockApi.joinTherapy).not.toHaveBeenCalled();
  });
});
