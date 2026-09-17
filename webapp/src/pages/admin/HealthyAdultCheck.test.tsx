// @vitest-environment jsdom
// Проверка текста в админке: пул живёт в БД и мимо гейтов репозитория, поэтому
// увидеть претензии к фразе можно только здесь (пропуск 2026-08 — фраза с
// мужским родом и выдуманным «несправлянием» доехала до пользователей).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react';
import { HealthyAdultCheck } from './HealthyAdultCheck';

vi.mock('../../api', () => ({
  api: { adminCheckPhrase: vi.fn(), adminAuditPhrases: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const type = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/Текст фразы/), { target: { value: text } });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('HealthyAdultCheck — проверка одной фразы', () => {
  it('«Проверить» заблокирована, пока поле пустое', () => {
    render(<HealthyAdultCheck adminKey="k" />);
    expect((screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement).disabled).toBe(true);
    type('текст');
    expect((screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('чистая фраза — так и написано', async () => {
    mockApi.adminCheckPhrase.mockResolvedValue({ issues: [] });
    render(<HealthyAdultCheck adminKey="k" />);
    type('Сегодня можно закрыть ноутбук на час раньше.');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText(/Чисто/)).toBeTruthy();
  });

  it('блокирующая претензия показана как запрет и с фрагментом', async () => {
    mockApi.adminCheckPhrase.mockResolvedValue({
      issues: [{ kind: 'род', rule: 'male-address', fragment: 'мальчиком', severity: 'block' }],
    });
    render(<HealthyAdultCheck adminKey="k" />);
    type('Тебе можно быть просто мальчиком.');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText(/Так сохранить не даст: 1/)).toBeTruthy();
    // Ищем внутри блока результата: тот же текст есть и в поле ввода.
    const result = within(screen.getByRole('status'));
    expect(result.getByText(/мальчиком/)).toBeTruthy();
    expect(result.getByText('мужской род')).toBeTruthy();
  });

  it('пометка не выдаётся за запрет — сохранить даст', async () => {
    mockApi.adminCheckPhrase.mockResolvedValue({
      issues: [{ kind: 'род', rule: 'male-third-person', fragment: 'мужчина', severity: 'warn' }],
    });
    render(<HealthyAdultCheck adminKey="k" />);
    type('Рядом был мужчина, который умел злиться без крика.');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText(/Сохранить даст, но стоит взглянуть/)).toBeTruthy();
    expect(screen.getByText(/спорно, решать автору/)).toBeTruthy();
  });

  it('правка текста сбрасывает прошлый результат — он уже не про этот текст', async () => {
    mockApi.adminCheckPhrase.mockResolvedValue({ issues: [] });
    render(<HealthyAdultCheck adminKey="k" />);
    type('первый');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText(/Чисто/)).toBeTruthy();
    type('второй');
    expect(screen.queryByText(/Чисто/)).toBeNull();
  });

  it('отказ сервера виден, а не проглочен', async () => {
    mockApi.adminCheckPhrase.mockRejectedValue(new Error('403'));
    render(<HealthyAdultCheck adminKey="k" />);
    type('текст');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect((await screen.findByRole('alert')).textContent).toContain('403');
  });
});

describe('HealthyAdultCheck — проверка всего пула', () => {
  it('показывает фразы с претензиями и их номера', async () => {
    mockApi.adminAuditPhrases.mockResolvedValue([
      {
        id: 7,
        text: 'Ты был хорошим ребёнком.',
        enabled: true,
        sortOrder: 0,
        issues: [{ kind: 'род', rule: 'ty-past', fragment: 'Ты был', severity: 'block' }],
      },
    ]);
    render(<HealthyAdultCheck adminKey="k" />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить весь пул' }));
    expect(await screen.findByText(/Фраз с претензиями: 1/)).toBeTruthy();
    expect(screen.getByText(/#7/)).toBeTruthy();
  });

  it('чистый пул — так и написано', async () => {
    mockApi.adminAuditPhrases.mockResolvedValue([]);
    render(<HealthyAdultCheck adminKey="k" />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить весь пул' }));
    expect(await screen.findByText('Весь пул чист.')).toBeTruthy();
  });

  it('результаты не смешиваются: проверка пула убирает результат одной фразы', async () => {
    mockApi.adminCheckPhrase.mockResolvedValue({ issues: [] });
    mockApi.adminAuditPhrases.mockResolvedValue([]);
    render(<HealthyAdultCheck adminKey="k" />);
    type('фраза');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(await screen.findByText(/Чисто — придраться/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить весь пул' }));
    await waitFor(() => expect(screen.queryByText(/Чисто — придраться/)).toBeNull());
    expect(screen.getByText('Весь пул чист.')).toBeTruthy();
  });
});
