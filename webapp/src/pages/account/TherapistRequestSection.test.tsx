// @vitest-environment jsdom
// Компонентные тесты TherapistRequestSection: статусы заявки на роль
// психолога (pending/approved/rejected), валидация полей, ошибка отправки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TherapistRequestSection } from './TherapistRequestSection';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TherapistRequestSection — загрузка статуса', () => {
  it('ничего не рендерит, пока GET /api/therapy/request не ответил (нет "мигания" пустой кнопкой)', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // висит
    const { container } = render(<TherapistRequestSection accessToken="tok" />);
    expect(container.textContent).toBe('');
  });

  it('без заявки (null) — кнопка «Я психолог – подать заявку»', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, null));
    render(<TherapistRequestSection accessToken="tok" />);
    await screen.findByText('👨‍⚕️ Я психолог – подать заявку');
  });
});

describe('TherapistRequestSection — статусы существующей заявки', () => {
  it('pending — сообщение "на рассмотрении", без формы', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, status: 'pending', rejectReason: null, createdAt: '2026-07-01', reviewedAt: null }));
    render(<TherapistRequestSection accessToken="tok" />);
    await screen.findByText(/на рассмотрении/);
    expect(screen.queryByText('ФИО')).toBeNull();
  });

  it('approved — сообщение "одобрена"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, status: 'approved', rejectReason: null, createdAt: '2026-07-01', reviewedAt: '2026-07-02' }));
    render(<TherapistRequestSection accessToken="tok" />);
    await screen.findByText(/Заявка одобрена/);
  });

  it('rejected — открытие формы показывает причину отказа', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, status: 'rejected', rejectReason: 'Не хватает подтверждения квалификации', createdAt: '2026-07-01', reviewedAt: '2026-07-02' }));
    render(<TherapistRequestSection accessToken="tok" />);
    const btn = await screen.findByText('👨‍⚕️ Я психолог – подать заявку');
    fireEvent.click(btn);

    await screen.findByText(/Не хватает подтверждения квалификации/);
  });
});

describe('TherapistRequestSection — отправка заявки', () => {
  async function openForm() {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, null));
    render(<TherapistRequestSection accessToken="tok" />);
    fireEvent.click(await screen.findByText('👨‍⚕️ Я психолог – подать заявку'));
    await screen.findByPlaceholderText('ФИО');
  }

  it('пустая форма — «Заполни ФИО, квалификацию и контакты», без сетевого вызова', async () => {
    await openForm();
    fireEvent.click(screen.getByText('Отправить заявку'));

    expect(await screen.findByText('Заполни ФИО, квалификацию и контакты')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // только начальный GET, без POST
  });

  it('заполненная форма отправляет POST с обрезанными полями и показывает "на рассмотрении"', async () => {
    await openForm();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    fireEvent.change(screen.getByPlaceholderText('ФИО'), { target: { value: '  Иван Иванов  ' } });
    fireEvent.change(screen.getByPlaceholderText('Квалификация: образование, направление, опыт, сертификаты'), { target: { value: 'Психолог, 5 лет' } });
    fireEvent.change(screen.getByPlaceholderText('Контакты: сайт, @telegram, b17 и т.д.'), { target: { value: '@ivan' } });
    fireEvent.click(screen.getByText('Отправить заявку'));

    await screen.findByText(/на рассмотрении/);
    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ fullName: 'Иван Иванов', qualification: 'Психолог, 5 лет', contacts: '@ivan' });
  });

  it('ошибка API показывает сообщение и оставляет форму открытой (не тишина)', async () => {
    await openForm();
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { message: 'Уже есть активная заявка' }));

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
