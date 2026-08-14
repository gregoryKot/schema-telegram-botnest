// @vitest-environment jsdom
// РЕГРЕССИЯ: ссылка-приглашение клиенту копировалась молча — если буфер
// недоступен (нет secure context, отказ в разрешении), терапевт не видел
// отказа и вставлял пустоту клиенту. Тест бьёт по стыку хук→компонент,
// как и требует read-after-write: сохранение (copyInvite) → отображение.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { AddClientForm } from './AddClientForm';
import { useAddClient } from './useAddClient';

vi.mock('../../api', () => ({
  api: {
    addVirtualClient: vi.fn(),
    createTherapyInvite: vi.fn(),
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
    fireEvent.change(screen.getByPlaceholderText('Имя клиента'), { target: { value: 'Иван' } });
    fireEvent.click(screen.getByText('Создать ссылку-приглашение'));
    await act(async () => { fireEvent.click(screen.getByText('Добавить')); });

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
    fireEvent.change(screen.getByPlaceholderText('Имя клиента'), { target: { value: 'Мария' } });
    fireEvent.click(screen.getByText('Создать ссылку-приглашение'));
    await act(async () => { fireEvent.click(screen.getByText('Добавить')); });

    await screen.findByText('https://example.com/ok');
    await act(async () => { fireEvent.click(screen.getByText('Скопировать')); });

    await screen.findByText('✓ Скопировано');
    expect(screen.queryByText(/Не удалось скопировать/)).toBeNull();
  });
});
