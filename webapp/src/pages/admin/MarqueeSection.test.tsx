// @vitest-environment jsdom
// Админ-вкладка «Бегущие строки» лендинга: две независимые редактируемые
// коллекции (А/Б) — добавить/удалить/переместить/сохранить. Ошибка сохранения
// обязана быть видна, а не выглядеть как успех.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MarqueeSection } from './MarqueeSection';

vi.mock('../../api', () => ({
  api: {
    getSiteContent: vi.fn(),
    adminSetMarquee: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSiteContent.mockResolvedValue({
    marqueeTopicsA: [{ label: 'Тревога', href: '#a' }],
    marqueeTopicsB: [{ label: 'Границы', href: '#b' }],
  });
});

afterEach(() => {
  cleanup();
});

describe('MarqueeSection — на чистом контенте пусто, не выдумка', () => {
  it('без строк в API — списки пустые, без хардкода', async () => {
    mockApi.getSiteContent.mockResolvedValue({ marqueeTopicsA: [], marqueeTopicsB: [] });
    render(<MarqueeSection adminKey="k" />);
    await screen.findByText('Бегущая строка А');
    expect(screen.queryByDisplayValue('Тревога')).toBeNull();
  });
});

describe('MarqueeSection — редактирование строки А', () => {
  it('показывает реальные пункты из API', async () => {
    render(<MarqueeSection adminKey="k" />);
    await screen.findByDisplayValue('Тревога');
    expect(screen.getByDisplayValue('Границы')).toBeTruthy();
  });

  it('«+ Добавить пункт» добавляет пустую строку в нужную коллекцию', async () => {
    render(<MarqueeSection adminKey="k" />);
    await screen.findByDisplayValue('Тревога');
    const addButtons = screen.getAllByRole('button', { name: '+ Добавить пункт' });
    fireEvent.click(addButtons[0]);
    const labelInputs = screen.getAllByPlaceholderText('Текст');
    // было 1 в строке А + 1 в строке Б = 2, после добавления в А — 3.
    expect(labelInputs.length).toBe(3);
  });

  it('удаление пункта убирает его из списка', async () => {
    render(<MarqueeSection adminKey="k" />);
    await screen.findByDisplayValue('Тревога');
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]);
    expect(screen.queryByDisplayValue('Тревога')).toBeNull();
  });

  it('сохранение отправляет только заполненные пункты для своей группы (read-after-write через API-вызов)', async () => {
    mockApi.adminSetMarquee.mockResolvedValue({ ok: true });
    render(<MarqueeSection adminKey="k" />);
    await screen.findByDisplayValue('Тревога');
    const saveButtons = screen.getAllByRole('button', { name: /Сохранить/ });
    fireEvent.click(saveButtons[0]);

    await screen.findByText('Сохранено ✓');
    expect(mockApi.adminSetMarquee).toHaveBeenCalledWith('k', 'A', [{ label: 'Тревога', href: '#a' }]);
  });

  it('ошибка сохранения — видна пользователю, «Сохранено» не показывается', async () => {
    mockApi.adminSetMarquee.mockRejectedValue(new Error('Не удалось сохранить бегущую строку'));
    render(<MarqueeSection adminKey="k" />);
    await screen.findByDisplayValue('Тревога');
    fireEvent.click(screen.getAllByRole('button', { name: /Сохранить/ })[0]);

    await screen.findByText('Не удалось сохранить бегущую строку');
    expect(screen.queryByText('Сохранено ✓')).toBeNull();
  });
});
