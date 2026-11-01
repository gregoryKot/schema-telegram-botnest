// @vitest-environment jsdom
// BecomeTherapistSection (webapp) — состояние заявки живёт внутри секции
// (в отличие от мини-аппа, где оно приходит пропами). Покрываем именно то,
// что раньше проверялось на уровне родителя SettingsSheet.test.tsx: статусы
// заявки, отправку (успех/ошибка сервера), клиентскую валидацию на ты/вы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BecomeTherapistSection } from './BecomeTherapistSection';
import { withAddressForm, fillTherapistRequestForm } from './SettingsSheet.test-helpers';
import * as LIM from '../../../../shared/src/limits/textLimits';

vi.mock('../../api', () => ({
  api: {
    getTherapistRequest: vi.fn(),
    submitTherapistRequest: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function renderWithForm(form: 'ty' | 'vy' = 'ty') {
  return render(withAddressForm(<BecomeTherapistSection />, form));
}

describe('BecomeTherapistSection — статусы заявки', () => {
  it('нет заявки — кнопка «Я психолог — подать заявку»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm();
    await screen.findByText('Я психолог — подать заявку');
  });

  it('status=pending — «Заявка на рассмотрении»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ status: 'pending', rejectReason: null });
    renderWithForm();
    const note = await screen.findByText('Заявка на рассмотрении.', { exact: false });
    // «Появится здесь» верно для обоих исходов: одобрение и отказ с причиной
    // рисуются в этом же блоке (тесты ниже).
    expect(note.textContent).toContain('Решение появится здесь');
  });

  it('status=approved — сообщение об одобрении', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ status: 'approved', rejectReason: null });
    renderWithForm();
    await screen.findByText('Заявка одобрена.', { exact: false });
  });

  it('status=rejected — видна причина отказа и можно подать снова', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ status: 'rejected', rejectReason: 'нет диплома' });
    renderWithForm();
    await screen.findByText(/Прошлая заявка отклонена: нет диплома/);
    expect(screen.getByText('Я психолог — подать заявку')).toBeTruthy();
  });

  it('getTherapistRequest() падает — форма доступна как для новой заявки', async () => {
    mockApi.getTherapistRequest.mockRejectedValue(new Error('network down'));
    renderWithForm();
    await screen.findByText('Я психолог — подать заявку');
  });
});

describe('BecomeTherapistSection — клиентская валидация (ты/вы)', () => {
  it('форма «ты»: пустая заявка просит на «ты»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm('ty');
    await screen.findByText('Я психолог — подать заявку');
    fireEvent.click(screen.getByText('Я психолог — подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('Заполни ФИО, квалификацию и контакты');
    expect(mockApi.submitTherapistRequest).not.toHaveBeenCalled();
  });

  it('форма «вы»: та же проверка звучит на «вы»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm('vy');
    await screen.findByText('Я психолог — подать заявку');
    fireEvent.click(screen.getByText('Я психолог — подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('Заполните ФИО, квалификацию и контакты');
  });
});

describe('BecomeTherapistSection — отправка заявки', () => {
  async function openAndFill() {
    fireEvent.click(await screen.findByText('Я психолог — подать заявку'));
    fillTherapistRequestForm();
  }

  it('успех: заявка уходит на сервер, форма закрывается, статус — «на рассмотрении»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    mockApi.submitTherapistRequest.mockResolvedValue(undefined);
    renderWithForm();
    await openAndFill();
    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() =>
      expect(mockApi.submitTherapistRequest).toHaveBeenCalledWith({
        fullName: 'Иван Иванов',
        qualification: 'Психолог',
        contacts: '@ivan',
        message: undefined,
      }),
    );
    await screen.findByText('Заявка на рассмотрении.', { exact: false });
    expect(screen.queryByPlaceholderText('ФИО')).toBeNull();
  });

  it('ошибка сервера: текст ошибки показан, форма остаётся открытой', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    mockApi.submitTherapistRequest.mockRejectedValue(new Error('уже подана заявка'));
    renderWithForm();
    await openAndFill();
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('уже подана заявка');
    expect(screen.getByPlaceholderText('ФИО')).toBeTruthy();
  });

  it('отмена формы очищает ошибку и возвращает к кнопке «Я психолог — подать заявку»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm();
    await screen.findByText('Я психолог — подать заявку');
    fireEvent.click(screen.getByText('Я психолог — подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));
    await screen.findByText('Заполни ФИО, квалификацию и контакты');

    fireEvent.click(screen.getByText('Отмена'));
    expect(screen.getByText('Я психолог — подать заявку')).toBeTruthy();
    expect(screen.queryByText('Заполни ФИО, квалификацию и контакты')).toBeNull();
  });
});

describe('BecomeTherapistSection — пределы длины (один источник с DTO сервера)', () => {
  it('поля держат maxLength из shared', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm();
    fireEvent.click(await screen.findByText('Я психолог — подать заявку'));
    const max = (placeholder: string) =>
      screen.getByPlaceholderText<HTMLInputElement>(placeholder).maxLength;
    expect(max('ФИО')).toBe(LIM.THERAPIST_REQUEST_NAME_MAX);
    expect(max('Квалификация: образование, направление, опыт, сертификаты')).toBe(LIM.THERAPIST_REQUEST_QUAL_MAX);
    expect(max('Контакты: сайт, @telegram, b17 и т.д.')).toBe(LIM.THERAPIST_REQUEST_CONTACTS_MAX);
    expect(max('Сообщение (необязательно)')).toBe(LIM.THERAPIST_REQUEST_MESSAGE_MAX);
  });
});
