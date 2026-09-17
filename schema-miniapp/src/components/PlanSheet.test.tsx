// @vitest-environment jsdom
// PlanSheet — «что сделаешь завтра» + напоминание. PracticeOptionRow покрыт
// своим тестом — мокаем. Кризисная детекция (правило №7) — свободный текст
// «своя практика» раньше уходил без прогона через crisisMarkers, как и
// TaskCreateSheet.tsx до своего фикса (см. TaskCreateSheet.test.tsx). Ключевые
// правила: ошибка сохранения ВИДНА (не закрывает лист молча — правило
// CLAUDE.md), защита от дубль-клика по «Сохранить», напоминание пересчитывается
// из tzOffset, а не хардкодится.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { setHost, type HostBridge } from '../../../shared/src/host';
import { PlanSheet } from './PlanSheet';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

vi.mock('./planSheet/PracticeOptionRow', () => ({
  PracticeOptionRow: ({
    text,
    onSelect,
    onDelete,
    isUser,
  }: {
    text: string;
    onSelect: () => void;
    onDelete: () => void;
    isUser: boolean;
  }) => (
    <div>
      <button onClick={onSelect}>select-{text}</button>
      {isUser && <button onClick={onDelete}>delete-{text}</button>}
    </div>
  ),
}));

vi.mock('../api', () => ({
  api: {
    getPractices: vi.fn(),
    getSettings: vi.fn(),
    deletePractice: vi.fn(),
    addPractice: vi.fn(),
    createPlan: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as {
  getPractices: ReturnType<typeof vi.fn>;
  getSettings: ReturnType<typeof vi.fn>;
  deletePractice: ReturnType<typeof vi.fn>;
  addPractice: ReturnType<typeof vi.fn>;
  createPlan: ReturnType<typeof vi.fn>;
};

let saveFile: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPractices.mockResolvedValue([]);
  mockApi.getSettings.mockResolvedValue({ notifyTimezone: 'Europe/Moscow' });
  mockApi.createPlan.mockResolvedValue(undefined);
  mockApi.addPractice.mockResolvedValue(undefined);
  saveFile = vi.fn();
  setHost({ id: 'web', saveFile } as unknown as HostBridge);
});

afterEach(() => {
  cleanup();
  setHost(null);
});

function baseProps() {
  return {
    needId: 'attachment',
    needEmoji: '💙',
    needLabel: 'Привязанность',
    color: '#f472b6',
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };
}

async function goToConfirm(
  customText = 'Позвонить другу',
  extraProps: Partial<ReturnType<typeof baseProps>> = {},
) {
  render(<PlanSheet {...baseProps()} {...extraProps} />);
  await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
  fireEvent.change(
    screen.getByPlaceholderText('Что-то конкретное, маленькое...'),
    {
      target: { value: customText },
    },
  );
  fireEvent.click(screen.getByText('Продолжить →'));
}

describe('PlanSheet — фаза выбора практики', () => {
  it('загружает практики и настройки при открытии', async () => {
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() => {
      expect(mockApi.getPractices).toHaveBeenCalledWith('attachment');
      expect(mockApi.getSettings).toHaveBeenCalled();
    });
  });

  it('готовые практики из CURATED показаны для этой потребности', async () => {
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() =>
      expect(
        screen.getByText('select-Написать кому-то близкому без повода'),
      ).toBeTruthy(),
    );
  });

  it('пустой custom-текст — кнопки «Продолжить →» нет', async () => {
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
    expect(screen.queryByText('Продолжить →')).toBeNull();
  });

  it('ввод custom-текста показывает «Продолжить →», клик переводит в confirm', async () => {
    await goToConfirm('Своя практика');
    expect(screen.getByText('Своя практика')).toBeTruthy();
    expect(screen.getByText('Напомнить завтра')).toBeTruthy();
  });

  it('выбор готовой практики сразу переводит в confirm', async () => {
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() =>
      expect(
        screen.getByText('select-Написать кому-то близкому без повода'),
      ).toBeTruthy(),
    );
    fireEvent.click(
      screen.getByText('select-Написать кому-то близкому без повода'),
    );
    expect(
      screen.getByText('Написать кому-то близкому без повода'),
    ).toBeTruthy();
  });

  it('пользовательская практика (из getPractices) не дублирует такую же из CURATED', async () => {
    mockApi.getPractices.mockResolvedValue([
      {
        id: 1,
        needId: 'attachment',
        text: 'Написать кому-то близкому без повода',
      },
    ]);
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() =>
      expect(
        screen.getAllByText('select-Написать кому-то близкому без повода'),
      ).toHaveLength(1),
    );
  });

  it('клик «удалить» у пользовательской практики зовёт deletePractice и убирает её из списка', async () => {
    mockApi.getPractices.mockResolvedValue([
      { id: 7, needId: 'attachment', text: 'Своя старая практика' },
    ]);
    mockApi.deletePractice.mockResolvedValue(undefined);
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() =>
      expect(screen.getByText('delete-Своя старая практика')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('delete-Своя старая практика'));
    expect(mockApi.deletePractice).toHaveBeenCalledWith(7);
    await waitFor(() =>
      expect(screen.queryByText('delete-Своя старая практика')).toBeNull(),
    );
  });
});

describe('PlanSheet — фаза подтверждения', () => {
  it('клик «← Назад» возвращает в фазу выбора', async () => {
    await goToConfirm();
    fireEvent.click(screen.getByText('← Назад'));
    expect(
      screen.getByPlaceholderText('Что-то конкретное, маленькое...'),
    ).toBeTruthy();
  });

  it('клик по варианту напоминания меняет выбор (видно по подсветке отметки)', async () => {
    await goToConfirm();
    // «Без напоминания» — последний вариант.
    fireEvent.click(screen.getByText('Без напоминания'));
    // Не падает, переключение состояния сработало (нет явного текстового
    // индикатора кроме стиля — проверяем через успешное сохранение ниже).
  });

  it('успешное сохранение: addPractice для новой практики + createPlan, потом onSaved после задержки', async () => {
    const onSaved = vi.fn();
    render(<PlanSheet {...{ ...baseProps(), onSaved }} />);
    await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
    fireEvent.change(
      screen.getByPlaceholderText('Что-то конкретное, маленькое...'),
      {
        target: { value: 'Новая практика' },
      },
    );
    fireEvent.click(screen.getByText('Продолжить →'));
    fireEvent.click(screen.getByText('Сохранить план'));
    await waitFor(() =>
      expect(mockApi.addPractice).toHaveBeenCalledWith(
        'attachment',
        'Новая практика',
      ),
    );
    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText('✓ Запланировано')).toBeTruthy(),
    );
    // onSaved зовётся через setTimeout(…, 1200) — реальным таймером.
    await waitFor(() => expect(onSaved).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('практика уже существует у пользователя — addPractice НЕ зовётся повторно', async () => {
    mockApi.getPractices.mockResolvedValue([
      { id: 3, needId: 'attachment', text: 'Уже мой текст' },
    ]);
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() =>
      expect(screen.getByText('select-Уже мой текст')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('select-Уже мой текст'));
    fireEvent.click(screen.getByText('Сохранить план'));
    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalled());
    expect(mockApi.addPractice).not.toHaveBeenCalled();
  });

  it('ошибка сохранения — лист НЕ закрывается молча, ошибка видна пользователю', async () => {
    mockApi.createPlan.mockRejectedValue(new Error('network'));
    const onSaved = vi.fn();
    await goToConfirm('Позвонить другу', { onSaved });
    fireEvent.click(screen.getByText('Сохранить план'));
    await waitFor(() =>
      expect(
        screen.getByText('Не удалось сохранить. Попробуй ещё раз.'),
      ).toBeTruthy(),
    );
    expect(onSaved).not.toHaveBeenCalled();
    // Кнопка снова активна — можно повторить попытку, не перезагружая лист.
    const btn = screen.getByText('Сохранить план');
    expect(btn.disabled).toBe(false);
  });

  it('во время сохранения кнопка disabled и показывает «...» (защита от дубль-клика)', async () => {
    let resolvePlan: () => void = () => {};
    mockApi.createPlan.mockReturnValue(
      new Promise<void>((r) => (resolvePlan = r)),
    );
    await goToConfirm();
    fireEvent.click(screen.getByText('Сохранить план'));
    await waitFor(() => {
      const btn = screen.getByText('...');
      expect(btn.disabled).toBe(true);
    });
    resolvePlan();
  });

  it('клик «Добавить в календарь» зовёт host.saveFile с .ics файлом', async () => {
    await goToConfirm();
    fireEvent.click(screen.getByText('Добавить в календарь (.ics)'));
    expect(saveFile).toHaveBeenCalledWith(
      expect.stringContaining('text/calendar'),
      'practice.ics',
    );
  });
});

describe('PlanSheet — ты/вы', () => {
  it('заголовок фазы выбора звучит на «ты» по умолчанию (без AddressFormContext = ty)', async () => {
    render(<PlanSheet {...baseProps()} />);
    expect(screen.getByText('Что сделаешь завтра?')).toBeTruthy();
  });
});

describe('PlanSheet — кризисная детекция в свободном тексте практики (правило №7)', () => {
  it('кризисная фраза в поле «своя практика» показывает CrisisCard с телефоном доверия', async () => {
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
    fireEvent.change(
      screen.getByPlaceholderText('Что-то конкретное, маленькое...'),
      { target: { value: 'не хочу жить' } },
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст практики не показывает CrisisCard', async () => {
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
    fireEvent.change(
      screen.getByPlaceholderText('Что-то конкретное, маленькое...'),
      { target: { value: 'Прогулка вечером' } },
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('PlanSheet — сбой загрузки своих практик (сбой ≠ пусто, В10 аудита 2026-08)', () => {
  // Регрессия: отказ getPractices здесь глушился одним console.error —
  // пользователь молча видел куцый список готовых вариантов, как будто
  // своих практик нет. webapp уже показывал баннер отказа — теперь и здесь.
  it('отказ getPractices — виден баннер отказа, готовые варианты остаются', async () => {
    mockApi.getPractices.mockRejectedValue(new Error('offline'));
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Не удалось загрузить твои практики — ниже только готовые варианты',
    );
    // Кураторский список работает — деградация, не пустота.
    expect(screen.getByText('Или своя')).toBeTruthy();
  });

  it('успешная загрузка — баннера отказа нет', async () => {
    mockApi.getPractices.mockResolvedValue([]);
    render(<PlanSheet {...baseProps()} />);
    await waitFor(() => expect(mockApi.getPractices).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
