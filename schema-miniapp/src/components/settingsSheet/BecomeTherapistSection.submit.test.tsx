// @vitest-environment jsdom
// BecomeTherapistSection — часть 2/2 (правило №10 — файл ≤300 строк):
// отправка заявки (успех + ошибка). Статусы/форма — в
// BecomeTherapistSection.test.tsx. Регрессионный кейс: catch-ветка отправки
// использовала жёсткую «ты»-форму («Ошибка. Попробуй ещё раз.») без tr(),
// хотя соседний useAddClient.ts уже делает это правильно — почищено в этом
// же PR (правило CLAUDE.md про ты/вы).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { BecomeTherapistSection } from './BecomeTherapistSection';

vi.mock('../../api', () => ({
  api: {
    submitTherapistRequest: vi.fn(),
    getTherapistRequest: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as {
  submitTherapistRequest: ReturnType<typeof vi.fn>;
  getTherapistRequest: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

function baseProps(
  overrides: Partial<Parameters<typeof BecomeTherapistSection>[0]> = {},
) {
  return {
    therapistReq: null,
    setTherapistReq: vi.fn(),
    showReqForm: false,
    setShowReqForm: vi.fn(),
    reqFullName: '',
    setReqFullName: vi.fn(),
    reqQual: '',
    setReqQual: vi.fn(),
    reqContacts: '',
    setReqContacts: vi.fn(),
    reqMsg: '',
    setReqMsg: vi.fn(),
    reqBusy: false,
    setReqBusy: vi.fn(),
    reqError: '',
    setReqError: vi.fn(),
    ...overrides,
  };
}

describe('BecomeTherapistSection — успешная отправка', () => {
  it('успех: submitTherapistRequest → getTherapistRequest → setTherapistReq и закрытие формы', async () => {
    mockApi.submitTherapistRequest.mockResolvedValue(undefined);
    mockApi.getTherapistRequest.mockResolvedValue({
      id: 5,
      status: 'pending',
      rejectReason: null,
    });
    const setTherapistReq = vi.fn();
    const setShowReqForm = vi.fn();
    render(
      <BecomeTherapistSection
        {...baseProps({
          showReqForm: true,
          reqFullName: 'Анна',
          reqQual: 'КПТ',
          reqContacts: '@anna',
          setTherapistReq,
          setShowReqForm,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Отправить'));
    await waitFor(() =>
      expect(setTherapistReq).toHaveBeenCalledWith({
        id: 5,
        status: 'pending',
        rejectReason: null,
      }),
    );
    expect(setShowReqForm).toHaveBeenCalledWith(false);
    expect(mockApi.submitTherapistRequest).toHaveBeenCalledWith({
      fullName: 'Анна',
      qualification: 'КПТ',
      contacts: '@anna',
      message: undefined,
    });
  });
});

describe('BecomeTherapistSection — ошибка отправки (регрессия ты/вы)', () => {
  it('API кинул ошибку без сообщения — форма «ты»: «Ошибка. Попробуй ещё раз.»', async () => {
    // Реальный String(new Error('')) даёт «Error» (без «Error: »), поэтому
    // такая ошибка НЕ падает в фолбэк — воспроизводим именно случай, когда
    // после replace('Error: ', '') остаётся пустая строка (сетевой сбой без
    // текста), чтобы проверить сам фолбэк, а не искусственно всегда попадать
    // в ветку с текстом ошибки.
    mockApi.submitTherapistRequest.mockRejectedValue('Error: ');
    const setReqError = vi.fn();
    renderWithForm(
      <BecomeTherapistSection
        {...baseProps({
          showReqForm: true,
          reqFullName: 'Анна',
          reqQual: 'КПТ',
          reqContacts: '@anna',
          setReqError,
        })}
      />,
      'ty',
    );
    fireEvent.click(screen.getByText('Отправить'));
    await waitFor(() =>
      expect(setReqError).toHaveBeenCalledWith('Ошибка. Попробуй ещё раз.'),
    );
  });

  it('API кинул ошибку без сообщения — форма «вы»: «Ошибка. Попробуйте ещё раз.», без «ты»-форм', async () => {
    // Реальный String(new Error('')) даёт «Error» (без «Error: »), поэтому
    // такая ошибка НЕ падает в фолбэк — воспроизводим именно случай, когда
    // после replace('Error: ', '') остаётся пустая строка (сетевой сбой без
    // текста), чтобы проверить сам фолбэк, а не искусственно всегда попадать
    // в ветку с текстом ошибки.
    mockApi.submitTherapistRequest.mockRejectedValue('Error: ');
    const setReqError = vi.fn();
    renderWithForm(
      <BecomeTherapistSection
        {...baseProps({
          showReqForm: true,
          reqFullName: 'Анна',
          reqQual: 'КПТ',
          reqContacts: '@anna',
          setReqError,
        })}
      />,
      'vy',
    );
    fireEvent.click(screen.getByText('Отправить'));
    await waitFor(() =>
      expect(setReqError).toHaveBeenCalledWith('Ошибка. Попробуйте ещё раз.'),
    );
    const msg = setReqError.mock.calls[
      setReqError.mock.calls.length - 1
    ][0] as string;
    expect(hasTyForms(msg)).toBe(false);
  });

  it('API кинул конкретную ошибку — показывает её текст, а не общий фолбэк', async () => {
    mockApi.submitTherapistRequest.mockRejectedValue(
      new Error('Request already pending'),
    );
    const setReqError = vi.fn();
    render(
      <BecomeTherapistSection
        {...baseProps({
          showReqForm: true,
          reqFullName: 'Анна',
          reqQual: 'КПТ',
          reqContacts: '@anna',
          setReqError,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Отправить'));
    await waitFor(() =>
      expect(setReqError).toHaveBeenCalledWith('Request already pending'),
    );
  });
});
