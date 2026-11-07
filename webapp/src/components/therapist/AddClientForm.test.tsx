// @vitest-environment jsdom
// РЕГРЕССИЯ: ссылка-приглашение клиенту копировалась молча — если буфер
// недоступен (нет secure context, отказ в разрешении), терапевт не видел
// отказа и вставлял пустоту клиенту. Тест бьёт по стыку хук→компонент,
// как и требует read-after-write: сохранение (copyInvite) → отображение.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { AddClientForm } from './AddClientForm';
import { useAddClient } from './useAddClient';
import { CLIENT_NAME_MAX } from '../../../../shared/src/limits/textLimits';

vi.mock('../../api', () => ({
  api: {
    addVirtualClient: vi.fn(),
    createTherapyInvite: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])),
    revokeTherapyInvite: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as { addVirtualClient: ReturnType<typeof vi.fn>; createTherapyInvite: ReturnType<typeof vi.fn> };

function Host() {
  const addClient = useAddClient({ setClients: vi.fn() });
  return <AddClientForm addClient={addClient} />;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AddClientForm — отказ буфера при копировании приглашения виден', () => {
  it('клипборд падает — надпись «Не удалось скопировать» появляется на экране', async () => {
    mockApi.addVirtualClient.mockResolvedValue([]);
    mockApi.createTherapyInvite.mockResolvedValue({ code: 'x', url: 'https://example.com/invite' });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });

    render(<Host />);
    fireEvent.change(screen.getByLabelText('Имя клиента'), { target: { value: 'Иван' } });
    fireEvent.click(screen.getByLabelText('Пригласить в приложение (ссылка и код)'));
    await act(async () => { fireEvent.click(screen.getByText('Создать приглашение')); });

    await screen.findByText('https://example.com/invite');
    await act(async () => { fireEvent.click(screen.getByText('Скопировать')); });

    expect(screen.queryByText('✓ Скопировано')).toBeNull();
    await screen.findByText(/Не удалось скопировать/);
  });

  it('клипборд успевает — надписи об ошибке нет', async () => {
    mockApi.addVirtualClient.mockResolvedValue([]);
    mockApi.createTherapyInvite.mockResolvedValue({ code: 'y', url: 'https://example.com/ok' });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    render(<Host />);
    fireEvent.change(screen.getByLabelText('Имя клиента'), { target: { value: 'Мария' } });
    fireEvent.click(screen.getByLabelText('Пригласить в приложение (ссылка и код)'));
    await act(async () => { fireEvent.click(screen.getByText('Создать приглашение')); });

    await screen.findByText('https://example.com/ok');
    await act(async () => { fireEvent.click(screen.getByText('Скопировать')); });

    await screen.findByText('✓ Скопировано');
    expect(screen.queryByText(/Не удалось скопировать/)).toBeNull();
  });
});

// Инцидент 2026-10-26: терапевт видел только ссылку t.me — клиенту на сайте
// код приходилось вырезать из адреса; рядом создавалась вторая, офлайн-карточка.
describe('AddClientForm — приглашение: код отдельно, офлайн-карточки нет', () => {
  it('после создания виден код с «Скопировать код» и подсказкой, куда его вводить', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({ code: '7F3A9C21B04E', url: 'https://t.me/b/diary?startapp=therapy_7F3A9C21B04E' });
    render(<Host />);
    fireEvent.change(screen.getByLabelText('Имя клиента'), { target: { value: 'Мария К.' } });
    fireEvent.click(screen.getByLabelText('Пригласить в приложение (ссылка и код)'));
    await act(async () => { fireEvent.click(screen.getByText('Создать приглашение')); });

    expect(await screen.findByText('Приглашение создано')).toBeTruthy();
    expect(screen.getByText('7F3A9C21B04E')).toBeTruthy();
    expect(screen.getByText('Скопировать код')).toBeTruthy();
    expect(screen.getByText(/«Мой терапевт»/)).toBeTruthy();
    expect(mockApi.createTherapyInvite).toHaveBeenCalledWith('Мария К.');
    expect(mockApi.addVirtualClient).not.toHaveBeenCalled();
  });

  it('без галочки — «Создать карточку» и офлайн-клиент, приглашения нет', async () => {
    mockApi.addVirtualClient.mockResolvedValue([]);
    render(<Host />);
    fireEvent.change(screen.getByLabelText('Имя клиента'), { target: { value: 'Пётр' } });
    await act(async () => { fireEvent.click(screen.getByText('Создать карточку')); });
    expect(await screen.findByText('Клиент добавлен')).toBeTruthy();
    expect(mockApi.createTherapyInvite).not.toHaveBeenCalled();
  });
});

// Аудит 2026-10-11: сервер ограничил имя офлайн-клиента (@MaxLength), поле
// обязано не пускать больше — иначе набранное имя вернётся 400 на «Добавить».
describe('AddClientForm — предел длины имени', () => {
  it('поле имени не принимает больше CLIENT_NAME_MAX знаков', () => {
    render(<Host />);
    const input = screen.getByLabelText('Имя клиента') as HTMLInputElement;
    expect(input.maxLength).toBe(CLIENT_NAME_MAX);
  });
});
