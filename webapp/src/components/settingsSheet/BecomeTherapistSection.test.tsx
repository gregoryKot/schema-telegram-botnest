// @vitest-environment jsdom
// BecomeTherapistSection (webapp) — состояние заявки живёт внутри секции
// (в отличие от мини-аппа, где оно приходит пропами). Покрываем именно то,
// что раньше проверялось на уровне родителя SettingsSheet.test.tsx: статусы
// заявки, отправку (успех/ошибка сервера), клиентскую валидацию на ты/вы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BecomeTherapistSection } from './BecomeTherapistSection';
import { AddressFormContext } from '../../utils/addressForm';

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
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <BecomeTherapistSection />
    </AddressFormContext.Provider>,
  );
}

describe('BecomeTherapistSection — статусы заявки', () => {
  it('нет заявки — кнопка «Подать заявку»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm();
    await screen.findByText('Подать заявку');
  });

  it('status=pending — «Заявка на рассмотрении»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ status: 'pending', rejectReason: null });
    renderWithForm();
    await screen.findByText('Заявка на рассмотрении.', { exact: false });
  });

  it('status=approved — сообщение об одобрении', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ status: 'approved', rejectReason: null });
    renderWithForm();
    await screen.findByText('Заявка одобрена.', { exact: false });
  });

  it('status=rejected — видна причина отказа и можно подать снова', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ status: 'rejected', rejectReason: 'нет диплома' });
    renderWithForm();
    await screen.findByText(/Заявка отклонена: нет диплома/);
    expect(screen.getByText('Подать заявку')).toBeTruthy();
  });

  it('getTherapistRequest() падает — форма доступна как для новой заявки', async () => {
    mockApi.getTherapistRequest.mockRejectedValue(new Error('network down'));
    renderWithForm();
    await screen.findByText('Подать заявку');
  });
});

describe('BecomeTherapistSection — клиентская валидация (ты/вы)', () => {
  it('форма «ты»: пустая заявка просит на «ты»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm('ty');
    await screen.findByText('Подать заявку');
    fireEvent.click(screen.getByText('Подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('Заполни ФИО, квалификацию и контакты');
    expect(mockApi.submitTherapistRequest).not.toHaveBeenCalled();
  });

  it('форма «вы»: та же проверка звучит на «вы»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm('vy');
    await screen.findByText('Подать заявку');
    fireEvent.click(screen.getByText('Подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText('Заполните ФИО, квалификацию и контакты');
  });
});

describe('BecomeTherapistSection — отправка заявки', () => {
  async function openAndFill() {
    fireEvent.click(await screen.findByText('Подать заявку'));
    fireEvent.change(screen.getByPlaceholderText('ФИО'), { target: { value: 'Иван Иванов' } });
    fireEvent.change(
      screen.getByPlaceholderText('Квалификация: образование, направление, опыт, сертификаты'),
      { target: { value: 'Психолог' } },
    );
    fireEvent.change(screen.getByPlaceholderText('Контакты: сайт, @telegram, b17 и т.д.'), {
      target: { value: '@ivan' },
    });
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

  it('отмена формы очищает ошибку и возвращает к кнопке «Подать заявку»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    renderWithForm();
    await screen.findByText('Подать заявку');
    fireEvent.click(screen.getByText('Подать заявку'));
    fireEvent.click(screen.getByText('Отправить заявку'));
    await screen.findByText('Заполни ФИО, квалификацию и контакты');

    fireEvent.click(screen.getByText('Отмена'));
    expect(screen.getByText('Подать заявку')).toBeTruthy();
    expect(screen.queryByText('Заполни ФИО, квалификацию и контакты')).toBeNull();
  });
});
