// @vitest-environment jsdom
// Админ-вкладка канала «Здоровый Взрослый»: пул фраз (добавить/сохранить/
// включить-выключить/удалить), тестовая отправка, массовый импорт (дочерний
// HealthyAdultImport — рендерится внутри секции, отдельного файла не заводим,
// см. правило №10). Скелетон остатка пула вместо спиннера/нуля — тоже здесь.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { HealthyAdultSection } from './HealthyAdultSection';

vi.mock('../../api', () => ({
  api: {
    adminListPhrases: vi.fn(),
    adminCreatePhrase: vi.fn(),
    adminUpdatePhrase: vi.fn(),
    adminDeletePhrase: vi.fn(),
    adminTestPhrasePost: vi.fn(),
    adminPhrasePoolStatus: vi.fn(),
    adminImportPhrases: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// window.confirm — компонент спрашивает подтверждение перед удалением.
const confirmSpy = vi.fn(() => true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
  confirmSpy.mockReturnValue(true);
  mockApi.adminListPhrases.mockResolvedValue([
    { id: 1, text: 'Устал – значит устал.', enabled: true },
  ]);
  mockApi.adminPhrasePoolStatus.mockResolvedValue({ enabled: 5, unused: 3, daysLeft: 20 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HealthyAdultSection — на чистом пуле пусто, не выдумка', () => {
  it('без фраз в API — «Активных фраз: 0 / 0», список пуст', async () => {
    mockApi.adminListPhrases.mockResolvedValue([]);
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByText('Активных фраз: 0 / 0');
  });
});

describe('HealthyAdultSection — счётчик и список', () => {
  it('показывает реальное число активных фраз из API', async () => {
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByText('Активных фраз: 1 / 1');
    expect(screen.getByDisplayValue('Устал – значит устал.')).toBeTruthy();
  });

  it('ошибка загрузки списка показывается, не молчаливый пустой экран', async () => {
    mockApi.adminListPhrases.mockRejectedValue(new Error('Не удалось получить пул'));
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByText('Не удалось получить пул');
  });
});

describe('HealthyAdultSection — добавить фразу', () => {
  it('пустой текст — кнопка «Добавить» задизейблена, запрос не уходит', async () => {
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    const addButton = screen.getByRole('button', { name: 'Добавить' });
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('добавил → фраза сразу видна в списке (read-after-write)', async () => {
    mockApi.adminCreatePhrase.mockResolvedValue({ id: 2, text: 'Ошибка не делает плохим.', enabled: true });
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    fireEvent.change(screen.getByPlaceholderText(/Безличная поддерживающая фраза/), {
      target: { value: 'Ошибка не делает плохим.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await screen.findByDisplayValue('Ошибка не делает плохим.');
    expect(mockApi.adminCreatePhrase).toHaveBeenCalledWith('k', 'Ошибка не делает плохим.');
  });

  it('ошибка добавления — видна, черновик не очищается молча', async () => {
    mockApi.adminCreatePhrase.mockRejectedValue(new Error('Дубль фразы'));
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    fireEvent.change(screen.getByPlaceholderText(/Безличная поддерживающая фраза/), { target: { value: 'та же' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await screen.findByText('Дубль фразы');
  });
});

describe('HealthyAdultSection — тестовая отправка', () => {
  it('успех — отчёт из ответа сервера показан как есть, не выдуман', async () => {
    mockApi.adminTestPhrasePost.mockResolvedValue({ message: 'Отправлено: «Устал – значит устал.»' });
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    fireEvent.click(screen.getByRole('button', { name: /Проверить: отправить сейчас/ }));

    await screen.findByText('Отправлено: «Устал – значит устал.»');
  });

  it('ошибка отправки — тоже показана в том же месте, а не потеряна', async () => {
    mockApi.adminTestPhrasePost.mockRejectedValue(new Error('Канал недоступен'));
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    fireEvent.click(screen.getByRole('button', { name: /Проверить: отправить сейчас/ }));

    await screen.findByText('Канал недоступен');
  });
});

describe('HealthyAdultSection — строка фразы (сохранить/вкл-выкл/удалить)', () => {
  it('кнопка «Сохранить» у строки задизейблена, пока текст не изменился', async () => {
    render(<HealthyAdultSection adminKey="k" />);
    const textarea = await screen.findByDisplayValue('Устал – значит устал.');
    const row = textarea.closest('section')!;
    expect((within(row).getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('изменил и сохранил → карточка обновляется по ответу сервера (read-after-write)', async () => {
    mockApi.adminUpdatePhrase.mockResolvedValue({ id: 1, text: 'Устал – это нормально.', enabled: true });
    render(<HealthyAdultSection adminKey="k" />);
    const textarea = await screen.findByDisplayValue('Устал – значит устал.');
    fireEvent.change(textarea, { target: { value: 'Устал – это нормально.' } });
    const row = textarea.closest('section')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Сохранить' }));

    await screen.findByText('Сохранено ✓');
    expect(mockApi.adminUpdatePhrase).toHaveBeenCalledWith('k', 1, { text: 'Устал – это нормально.' });
  });

  it('«Выключить» переключает фразу и подпись', async () => {
    mockApi.adminUpdatePhrase.mockResolvedValue({ id: 1, text: 'Устал – значит устал.', enabled: false });
    render(<HealthyAdultSection adminKey="k" />);
    const textarea = await screen.findByDisplayValue('Устал – значит устал.');
    const row = textarea.closest('section')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Выключить' }));

    await within(row).findByText('выключена');
    expect(mockApi.adminUpdatePhrase).toHaveBeenCalledWith('k', 1, { enabled: false });
  });

  it('удаление без подтверждения (confirm=false) фразу НЕ убирает', async () => {
    confirmSpy.mockReturnValue(false);
    render(<HealthyAdultSection adminKey="k" />);
    const textarea = await screen.findByDisplayValue('Устал – значит устал.');
    const row = textarea.closest('section')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Удалить' }));

    expect(mockApi.adminDeletePhrase).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Устал – значит устал.')).toBeTruthy();
  });

  it('удаление с подтверждением убирает фразу из списка', async () => {
    mockApi.adminDeletePhrase.mockResolvedValue(undefined);
    render(<HealthyAdultSection adminKey="k" />);
    const textarea = await screen.findByDisplayValue('Устал – значит устал.');
    const row = textarea.closest('section')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Удалить' }));

    await screen.findByText('Активных фраз: 0 / 0');
    expect(screen.queryByDisplayValue('Устал – значит устал.')).toBeNull();
  });
});

describe('HealthyAdultSection — массовый импорт (HealthyAdultImport)', () => {
  it('остаток пула — скелетон до ответа API, потом реальные числа (не 0/спиннер)', async () => {
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByText(/Ещё не звучали: 3 из 5/);
  });

  it('пустая строка не считается — кнопка показывает 0 и задизейблена', async () => {
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    const textarea = screen.getByPlaceholderText(/Устал – значит устал/);
    fireEvent.change(textarea, { target: { value: '\n\n  \n' } });
    expect(screen.getByRole('button', { name: 'Добавить (0)' })).toBeTruthy();
  });

  it('успешный импорт → отчёт показан, добавленные фразы попадают в общий список (read-after-write)', async () => {
    mockApi.adminImportPhrases.mockResolvedValue({
      message: 'Добавлено 2, дублей 0',
      created: [
        { id: 10, text: 'Первая новая фраза.', enabled: true },
        { id: 11, text: 'Вторая новая фраза.', enabled: true },
      ],
    });
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    const textarea = screen.getByPlaceholderText(/Устал – значит устал/);
    fireEvent.change(textarea, { target: { value: 'Первая новая фраза.\nВторая новая фраза.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить (2)' }));

    await screen.findByText('Добавлено 2, дублей 0');
    expect(screen.getByDisplayValue('Первая новая фраза.')).toBeTruthy();
    expect(screen.getByDisplayValue('Вторая новая фраза.')).toBeTruthy();
  });

  it('ошибка импорта — видна, черновик НЕ очищается (можно поправить и повторить)', async () => {
    mockApi.adminImportPhrases.mockRejectedValue(new Error('Сервер недоступен'));
    render(<HealthyAdultSection adminKey="k" />);
    await screen.findByDisplayValue('Устал – значит устал.');
    const textarea = screen.getByPlaceholderText(/Устал – значит устал/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Фраза, которая не сохранится.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить (1)' }));

    await screen.findByText('Сервер недоступен');
    expect(textarea.value).toBe('Фраза, которая не сохранится.');
  });
});
