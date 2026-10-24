// @vitest-environment jsdom
// AdminPage — единая админка с ключом доступа и вкладками (0% покрытия).
// Секции-вкладки мокаем заглушками (у каждой свои тесты) — здесь проверяем
// только сам AdminPage: гейт по ключу (ключ только в памяти,
// видимая ошибка на неверный ключ) и переключение вкладок.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
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

  // Вебвизор включается на визитке (kotlarewski.gr, metrika.ts shouldRecordSession),
  // и /admin — часть её allow-list (practice-domain.middleware.ts). Экран
  // редактирования сайта не должен уйти в запись сессии — ym-hide-content
  // (метка Яндекса «не писать содержимое») на обоих состояниях экрана.
  it('экран входа по ключу несёт ym-hide-content — Вебвизор не пишет содержимое', () => {
    render(<AdminPage />);
    const heading = screen.getByText('Введите ключ доступа (ADMIN_BOOKING_KEY).');
    expect(heading.closest('.ym-hide-content')).toBeTruthy();
  });

  it('неверный ключ показывает видимую ошибку, не пускает в админку молча', async () => {
    adminStatus.mockRejectedValue(new Error('403'));
    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText('Ключ'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Войти'));
    expect(await screen.findByText('Неверный ключ')).toBeTruthy();
  });

  // Аудит 2026-10, E4: ключ только в памяти страницы — XSS не вычитает его из хранилища.
  it('верный ключ открывает вкладки и НЕ пишется ни в sessionStorage, ни в localStorage', async () => {
    adminStatus.mockResolvedValue({});
    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText('Ключ'), { target: { value: 'right-key' } });
    fireEvent.click(screen.getByText('Войти'));

    expect(await screen.findByText('Секция: Запись')).toBeTruthy();
    expect(sessionStorage.getItem('booking_admin_key')).toBeNull();
    expect(localStorage.getItem('booking_admin_key')).toBeNull();
    for (const store of [sessionStorage, localStorage]) {
      for (let i = 0; i < store.length; i++) {
        expect(store.getItem(store.key(i) as string)).not.toContain('right-key');
      }
    }
  });

  it('ключ от прежней версии в sessionStorage не используется для входа', async () => {
    sessionStorage.setItem('booking_admin_key', 'stale-key');
    adminStatus.mockResolvedValue({});
    render(<AdminPage />);
    await act(async () => {});
    expect(adminStatus).not.toHaveBeenCalled();
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

  it('авторизованный экран тоже несёт ym-hide-content', async () => {
    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText('Ключ'), { target: { value: 'k' } });
    fireEvent.click(screen.getByText('Войти'));
    const section = await screen.findByText('Секция: Запись');
    expect(section.closest('.ym-hide-content')).toBeTruthy();
  });
});
