// @vitest-environment jsdom
// U5 (аудит 2026-11): уведомления уходят только в Telegram, а человек с
// Google, почтой или MAX выбирал «Напомнить завтра 09:00» — и напоминание не
// приходило. Без канала лист говорит это прямо, и главная кнопка —
// «Добавить в календарь»; с каналом — выбор напоминания как раньше.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PlanSheet } from './PlanSheet';
import { setHost, type HostBridge } from '../../../shared/src/host';

vi.mock('../api', () => ({
  api: {
    getPractices: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn(),
    addPractice: vi.fn().mockResolvedValue(undefined),
    createPlan: vi.fn().mockResolvedValue(undefined),
    deletePractice: vi.fn().mockResolvedValue(undefined),
    practiceIcsLink: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const saveFile = vi.fn();

async function openConfirm(notifyReachable: boolean, form: 'ty' | 'vy' = 'ty') {
  mockApi.getSettings.mockResolvedValue({ notifyTimezone: 'Europe/Moscow', notifyReachable });
  await act(async () => {
    render(
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <MemoryRouter>
          <PlanSheet needId="attachment" needLabel="Привязанность" onClose={vi.fn()} onSaved={vi.fn()} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
  });
  fireEvent.change(screen.getByPlaceholderText('Что-то конкретное, маленькое...'), { target: { value: 'Позвонить маме' } });
  fireEvent.click(screen.getByText('Продолжить →'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPractices.mockResolvedValue([]);
  mockApi.addPractice.mockResolvedValue(undefined);
  mockApi.createPlan.mockResolvedValue(undefined);
  setHost({ id: 'web', saveFile, capabilities: { dataUrlFiles: true } } as unknown as HostBridge);
});

afterEach(() => { cleanup(); setHost(null); });

describe('PlanSheet — напоминанию некуда прийти', () => {
  it('честная строка вместо обещания, выбора «Напомнить завтра» и «Без напоминания» нет', async () => {
    await openConfirm(false);
    expect(screen.getByRole('note').textContent).toBe(
      'Напоминания приходят в Telegram — у тебя он не подключён. Поставь шаг в календарь: напомнит он.',
    );
    expect(screen.queryByText('Напомнить завтра')).toBeNull();
    expect(screen.queryByText('Без напоминания')).toBeNull();
    expect(screen.getByText('Время в календаре')).toBeTruthy();
  });

  it('строка звучит на «вы»', async () => {
    await openConfirm(false, 'vy');
    expect(screen.getByRole('note').textContent).toContain('у вас он не подключён. Поставьте шаг в календарь');
  });

  it('главная кнопка «Добавить в календарь» отдаёт .ics и сохраняет план с выбранным часом', async () => {
    await openConfirm(false);
    fireEvent.click(screen.getByText('Вечером'));
    await act(async () => { fireEvent.click(screen.getByText('Добавить в календарь')); });
    expect(saveFile).toHaveBeenCalledWith(expect.stringContaining('text/calendar'), 'practice.ics');
    expect(decodeURIComponent(saveFile.mock.calls[0][0])).toContain('BEGIN:VALARM');
    expect(mockApi.createPlan).toHaveBeenCalledWith('attachment', 'Позвонить маме', 19);
    expect(screen.getByText('Запланировано')).toBeTruthy();
  });

  it('«Google Календарь» — ссылка на событие завтра в выбранный час, тап сохраняет план', async () => {
    await openConfirm(false);
    fireEvent.click(screen.getByText('Утром'));
    const link = screen.getByText('Google Календарь ↗').closest('a')!;
    const url = new URL(link.href);
    expect(url.host).toBe('calendar.google.com');
    expect(url.searchParams.get('text')).toBe('Позвонить маме');
    expect(url.searchParams.get('dates')).toMatch(/^\d{8}T060000Z\/\d{8}T063000Z$/); // 09:00 по Москве
    await act(async () => { fireEvent.click(link); });
    expect(mockApi.createPlan).toHaveBeenCalledTimes(1);
  });

  it('«Сохранить без календаря» сохраняет план без файла; второй тап не создаёт второй план', async () => {
    await openConfirm(false);
    await act(async () => { fireEvent.click(screen.getByText('Сохранить без календаря')); });
    await act(async () => { fireEvent.click(screen.getByText('Google Календарь ↗')); });
    expect(saveFile).not.toHaveBeenCalled();
    expect(mockApi.createPlan).toHaveBeenCalledTimes(1);
  });
});

describe('PlanSheet — Telegram подключён', () => {
  it('выбор напоминания как раньше, честной строки и календарных кнопок-замен нет', async () => {
    await openConfirm(true);
    expect(screen.getByText('Напомнить завтра')).toBeTruthy();
    expect(screen.getByText('Без напоминания')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText('Google Календарь ↗')).toBeNull();
    fireEvent.click(screen.getByText('Сохранить план'));
    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalled());
  });
});

// E6 (аудит 2026-11): в Telegram файл отдаёт сервер по https-ссылке.
describe('PlanSheet — Telegram: .ics по ссылке с сервера', () => {
  // id 'web': getHost() сверяет id с окружением и заменил бы фейк с id 'telegram'
  // настоящим адаптером браузера; суть хоста Telegram здесь — dataUrlFiles: false.
  const tgHost = () => setHost({ id: 'web', saveFile, capabilities: { dataUrlFiles: false } } as unknown as HostBridge);

  it('файл открывается https-ссылкой, data:-URL в хост не уходит', async () => {
    tgHost();
    mockApi.practiceIcsLink.mockResolvedValue({ path: '/api/plan/ics/TOKEN' });
    await openConfirm(true);
    await act(async () => { fireEvent.click(screen.getByText('Добавить в календарь (.ics)')); });
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(saveFile.mock.calls[0][0]).toMatch(/^https?:\/\/[^/]+\/api\/plan\/ics\/TOKEN$/);
  });

  it('сервер не ответил — строка об этом, на «вы»', async () => {
    tgHost();
    mockApi.practiceIcsLink.mockRejectedValue(new Error('503'));
    await openConfirm(true, 'vy');
    await act(async () => { fireEvent.click(screen.getByText('Добавить в календарь (.ics)')); });
    expect(screen.getByRole('alert').textContent).toBe('Файл для календаря не открылся. Попробуйте ещё раз.');
    expect(saveFile).not.toHaveBeenCalled();
  });
});
