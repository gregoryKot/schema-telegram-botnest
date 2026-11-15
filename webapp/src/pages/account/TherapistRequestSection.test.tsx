// @vitest-environment jsdom
// Компонентные тесты TherapistRequestSection: статусы заявки на роль
// психолога (pending/approved/rejected), валидация полей, ошибка отправки.
// Сеть — api-слой (мок); шов с транспортом — therapistRequest.seam.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TherapistRequestSection } from './TherapistRequestSection';
import * as LIM from '../../../../shared/src/limits/textLimits';
import { THERAPIST_REQUEST_PENDING } from '../../../../shared/src/therapy/therapistRequestCopy';

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

describe('TherapistRequestSection — загрузка статуса', () => {
  it('ничего не рендерит, пока GET /api/therapy/request не ответил (нет "мигания" пустой кнопкой)', () => {
    mockApi.getTherapistRequest.mockReturnValue(new Promise(() => {})); // висит
    const { container } = render(<TherapistRequestSection />);
    expect(container.textContent).toBe('');
  });

  it('без заявки (null) — кнопка «Я психолог — подать заявку»', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    render(<TherapistRequestSection />);
    await screen.findByText('Я психолог — подать заявку');
  });
});

describe('TherapistRequestSection — статусы существующей заявки', () => {
  it('pending — сообщение "на рассмотрении", без формы', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ id: 1, status: 'pending', rejectReason: null });
    render(<TherapistRequestSection />);
    const note = await screen.findByText(/на рассмотрении/);
    expect(screen.queryByText('ФИО')).toBeNull();
    // Решение приходит не только в бота: заявку подают и с сайта (аудит 2026-10).
    // «Решение появится здесь» тут неверно: отказ виден только внутри раскрытой
    // формы (тест ниже), поэтому обещаем сообщение и смену статуса.
    // Одна строка с листом настроек (shared/src/therapy/therapistRequestCopy.ts, U12).
    expect(note.textContent).toBe(THERAPIST_REQUEST_PENDING);
    expect(note.textContent).not.toContain('в боте');
    expect(note.textContent).not.toContain('появится здесь');
  });

  it('approved — сообщение "одобрена"', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ id: 1, status: 'approved', rejectReason: null });
    render(<TherapistRequestSection />);
    await screen.findByText(/Заявка одобрена/);
  });

  // До 2026-11 причина была видна только внутри раскрытой формы.
  it('rejected — причина видна сразу и остаётся при открытой форме', async () => {
    mockApi.getTherapistRequest.mockResolvedValue({ id: 1, status: 'rejected', rejectReason: 'Не хватает подтверждения квалификации' });
    render(<TherapistRequestSection />);
    await screen.findByText(/Не хватает подтверждения квалификации/);
    fireEvent.click(screen.getByText('Я психолог — подать заявку'));

    await screen.findByPlaceholderText('ФИО');
    expect(screen.getByText(/Не хватает подтверждения квалификации/)).toBeTruthy();
  });
});

describe('TherapistRequestSection — отправка заявки', () => {
  async function openForm() {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    render(<TherapistRequestSection />);
    fireEvent.click(await screen.findByText('Я психолог — подать заявку'));
    await screen.findByPlaceholderText('ФИО');
  }

  it('пустая форма — «Заполни ФИО, квалификацию и контакты», без сетевого вызова', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Отправить заявку'));

    expect(await screen.findByText('Заполни ФИО, квалификацию и контакты')).toBeTruthy();
    expect(mockApi.submitTherapistRequest).not.toHaveBeenCalled();
  });

  it('заполненная форма отправляет заявку с обрезанными полями и показывает "на рассмотрении"', async () => {
    await openForm();
    mockApi.submitTherapistRequest.mockResolvedValue({ ok: true });

    fireEvent.change(screen.getByPlaceholderText('ФИО'), { target: { value: '  Иван Иванов  ' } });
    fireEvent.change(screen.getByPlaceholderText('Квалификация: образование, направление, опыт, сертификаты'), { target: { value: 'Психолог, 5 лет' } });
    fireEvent.change(screen.getByPlaceholderText('Контакты: сайт, @telegram, b17 и т.д.'), { target: { value: '@ivan' } });
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText(/на рассмотрении/);
    expect(mockApi.submitTherapistRequest).toHaveBeenCalledWith({
      fullName: 'Иван Иванов', qualification: 'Психолог, 5 лет', contacts: '@ivan', message: undefined,
    });
  });

  it('ошибка API показывает сообщение и оставляет форму открытой (не тишина)', async () => {
    await openForm();
    mockApi.submitTherapistRequest.mockRejectedValue(new Error('Уже есть активная заявка'));

    fireEvent.change(screen.getByPlaceholderText('ФИО'), { target: { value: 'Иван' } });
    fireEvent.change(screen.getByPlaceholderText('Квалификация: образование, направление, опыт, сертификаты'), { target: { value: 'Психолог' } });
    fireEvent.change(screen.getByPlaceholderText('Контакты: сайт, @telegram, b17 и т.д.'), { target: { value: '@ivan' } });
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText(/Уже есть активная заявка/);
    expect(screen.getByPlaceholderText('ФИО')).toBeTruthy();
  });

  it('«Отмена» закрывает форму без вызова api', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Отмена'));

    await waitFor(() => expect(screen.queryByPlaceholderText('ФИО')).toBeNull());
    expect(mockApi.submitTherapistRequest).not.toHaveBeenCalled();
  });
});

describe('TherapistRequestSection — пределы длины (один источник с DTO сервера)', () => {
  it('поля держат maxLength из shared; у textarea есть счётчик остатка', async () => {
    mockApi.getTherapistRequest.mockResolvedValue(null);
    render(<TherapistRequestSection />);
    fireEvent.click(await screen.findByText('Я психолог — подать заявку'));
    const max = (placeholder: string) =>
      screen.getByPlaceholderText<HTMLInputElement>(placeholder).maxLength;
    expect(max('ФИО')).toBe(LIM.THERAPIST_REQUEST_NAME_MAX);
    expect(max('Квалификация: образование, направление, опыт, сертификаты')).toBe(LIM.THERAPIST_REQUEST_QUAL_MAX);
    expect(max('Контакты: сайт, @telegram, b17 и т.д.')).toBe(LIM.THERAPIST_REQUEST_CONTACTS_MAX);
    expect(max('Сообщение админу (необязательно)')).toBe(LIM.THERAPIST_REQUEST_MESSAGE_MAX);

    // Счётчик остатка появляется у границы: «осталось N», а не молчаливый отказ ввода.
    fireEvent.change(
      screen.getByPlaceholderText('Квалификация: образование, направление, опыт, сертификаты'),
      { target: { value: 'x'.repeat(LIM.THERAPIST_REQUEST_QUAL_MAX - 10) } },
    );
    expect(screen.getByText('Осталось знаков: 10')).toBeTruthy();
  });
});
