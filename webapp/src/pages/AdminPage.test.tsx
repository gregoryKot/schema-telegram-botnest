// @vitest-environment jsdom
// AdminPage — единая админка с ключом доступа и вкладками (0% покрытия).
// Секции-вкладки мокаем заглушками (у каждой свои тесты) — здесь проверяем
// только сам AdminPage: гейт по ключу (сохранение/сброс в localStorage,
// видимая ошибка на неверный ключ) и переключение вкладок.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AdminPage } from './AdminPage';

const adminStatus = vi.fn();
vi.mock('../api', () => ({
  api: { adminStatus: (...a: unknown[]) => adminStatus(...a) },
}));

vi.mock('./admin/BookingSection', () => ({ BookingSection: () => <div>Секция: Запись</div> }));
vi.mock('./admin/ArticlesSection', () => ({ ArticlesSection: () => <div>Секция: Статьи</div> }));
vi.mock('./admin/PhotoSection', () => ({ PhotoSection: () => <div>Секция: Фото</div> }));
vi.mock('./admin/MarqueeSection', () => ({ MarqueeSection: () => <div>Секция: Бегущая строка</div> }));
vi.mock('./admin/HealthyAdultSection', () => ({ HealthyAdultSection: () => <div>Секция: Канал ЗВ</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe('AdminPage — вход по ключу', () => {
  it('без сохранённого ключа показывает форму входа, а не сразу админку', () => {
    render(<AdminPage />);
    expect(screen.getByText('Введите ключ доступа (ADMIN_BOOKING_KEY).')).toBeTruthy();
  });

  it('неверный ключ показывает видимую ошибку, не пускает в админку молча', async () => {
    adminStatus.mockRejectedValue(new Error('403'));
    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText('Ключ'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Войти'));
    expect(await screen.findByText('Неверный ключ')).toBeTruthy();
  });

  it('верный ключ сохраняется в sessionStorage (L7), НЕ в localStorage, и открывает вкладки', async () => {
    adminStatus.mockResolvedValue({});
    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText('Ключ'), { target: { value: 'right-key' } });
    fireEvent.click(screen.getByText('Войти'));

    expect(await screen.findByText('Секция: Запись')).toBeTruthy();
    expect(sessionStorage.getItem('booking_admin_key')).toBe('right-key');
    expect(localStorage.getItem('booking_admin_key')).toBeNull();
  });

  it('сохранённый, но более не валидный ключ сбрасывается — не залипает без доступа', async () => {
    sessionStorage.setItem('booking_admin_key', 'stale-key');
    adminStatus.mockRejectedValue(new Error('403'));
    render(<AdminPage />);
    await waitFor(() => expect(sessionStorage.getItem('booking_admin_key')).toBeNull());
    expect(screen.getByText('Введите ключ доступа (ADMIN_BOOKING_KEY).')).toBeTruthy();
  });
});

describe('AdminPage — переключение вкладок', () => {
  beforeEach(() => {
    adminStatus.mockResolvedValue({});
  });

  it('по умолчанию открыта вкладка «Запись», переключение показывает другую секцию', async () => {
    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText('Ключ'), { target: { value: 'k' } });
    fireEvent.click(screen.getByText('Войти'));
    await screen.findByText('Секция: Запись');

    fireEvent.click(screen.getByText('Канал ЗВ'));
    expect(screen.getByText('Секция: Канал ЗВ')).toBeTruthy();
    expect(screen.queryByText('Секция: Запись')).toBeNull();
  });
});
