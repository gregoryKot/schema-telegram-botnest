// @vitest-environment jsdom
// Компонентные тесты DiarySection («Записи», простой клиент, этап 3): реальные
// записи из api (без хардкод-заглушек), пустое онбординг-объяснение, сегмент
// «Все · Трекер · Дневник», строки трекера по дням, серия, удаление с
// подтверждением, черновики мастеров, ошибки API не роняют экран.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiarySection } from './DiarySection';
import { saveDraft, clearDraft } from '../utils/drafts';
import { todayStr } from '../utils/format';

// SchemaEntrySheet/ModeEntrySheet/GratitudeEntrySheet используют
// useHistorySheet (нужен Router) — оборачиваем все рендеры.
function renderSection(onOpenTrackerHistory?: () => void) {
  return render(
    <MemoryRouter>
      <DiarySection onOpenTrackerHistory={onOpenTrackerHistory} />
    </MemoryRouter>,
  );
}

// Листы создания записи — тяжёлые формы (не в скоупе этого файла).
// Мокаем кнопочницей, чтобы проверить только то, что решает сам
// DiarySection: onSave добавляет запись в список и закрывает лист.
vi.mock('../components/diary/SchemaEntrySheet', () => ({
  SchemaEntrySheet: (p: { onClose: () => void; onSave: (d: { trigger: string; emotions: string[]; schemaIds: string[] }) => Promise<void> }) => (
    <div data-testid="schema-entry-sheet">
      <button onClick={() => p.onSave({ trigger: 'Новый триггер', emotions: [], schemaIds: [] })}>Сохранить схему</button>
      <button onClick={p.onClose}>Закрыть лист схемы</button>
    </div>
  ),
}));
vi.mock('../components/diary/ModeEntrySheet', () => ({
  ModeEntrySheet: (p: { onClose: () => void; onSave: (d: { situation: string; modeId: string }) => Promise<void> }) => (
    <div data-testid="mode-entry-sheet">
      <button onClick={() => p.onSave({ situation: 'Новая ситуация', modeId: 'critic' })}>Сохранить режим</button>
      <button onClick={p.onClose}>Закрыть лист режима</button>
    </div>
  ),
}));
vi.mock('../components/diary/GratitudeEntrySheet', () => ({
  GratitudeEntrySheet: (p: { onClose: () => void; date: string; existingItems?: string[]; onSave: (date: string, items: string[], base: string[]) => Promise<void> }) => (
    <div data-testid="gratitude-entry-sheet">
      <div data-testid="gratitude-existing">{JSON.stringify(p.existingItems ?? null)}</div>
      <button onClick={() => p.onSave(p.date, ['Новый пункт'], p.existingItems ?? [])}>Сохранить благодарность</button>
      <button onClick={p.onClose}>Закрыть лист благодарности</button>
    </div>
  ),
}));

vi.mock('../components/diary/QuickEntrySheet', () => ({
  QuickEntrySheet: (p: { onClose: () => void; onSaved?: () => void }) => (
    <div data-testid="quick-entry-sheet">
      <button onClick={p.onSaved}>Имитировать сохранение</button>
      <button onClick={p.onClose}>Закрыть быструю запись</button>
    </div>
  ),
}));

vi.mock('../api', () => ({
  api: {
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    getProfile: vi.fn(),
    history: vi.fn(),
    deleteSchemaDiary: vi.fn(),
    deleteModeDiary: vi.fn(),
    deleteGratitudeDiary: vi.fn(),
    createSchemaDiary: vi.fn(),
    createModeDiary: vi.fn(),
    createGratitudeDiary: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function schemaEntry(overrides: Partial<{ id: number; createdAt: string; trigger: string; schemaIds: string[] }> = {}) {
  return {
    id: 1, createdAt: '2026-08-01T10:00:00Z', trigger: 'Коллега не ответил на сообщение',
    emotions: [], schemaIds: [],
    ...overrides,
  };
}
function modeEntry(overrides: Partial<{ id: number; createdAt: string; situation: string; modeId: string }> = {}) {
  return { id: 1, createdAt: '2026-08-01T11:00:00Z', situation: 'Критика на работе', modeId: 'vulnerable_child', ...overrides };
}
function gratitudeEntry(overrides: Partial<{ id: number; date: string; items: string[] }> = {}) {
  return { id: 1, date: '2026-08-01', items: ['Хорошая погода'], createdAt: '2026-08-01T20:00:00Z', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  mockApi.getProfile.mockResolvedValue({ ysq: { activeSchemaIds: [] }, streak: 0 });
  mockApi.history.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

const rated = (date: string, values: number[]) => ({
  date,
  ratings: Object.fromEntries(['attachment', 'autonomy', 'expression', 'play', 'limits'].slice(0, values.length).map((id, i) => [id, values[i]])),
});

describe('DiarySection — шапка и вход «Записать»', () => {
  it('eyebrow «Записи», заголовок «Что было», без счётчика «N/31», трёх карточек входа и строки «Архив»', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    renderSection();
    await screen.findByText('Коллега не ответил на сообщение');
    expect(screen.getByText('Записи', { selector: '.ds-eyebrow' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Что было' })).toBeTruthy();
    expect(document.querySelector('.cd-stats')).toBeNull();
    expect(document.querySelector('.cd-quick')).toBeNull();
    expect(screen.queryByText(/Архив ·/)).toBeNull();
    expect(screen.queryByText('Трекер потребностей')).toBeNull();
  });

  it('«Записать» открывает «Дневник одной страницей»; после сохранения лента перечитывается', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Записать' }));
    await screen.findByTestId('quick-entry-sheet');
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Только что записанное' })]);
    fireEvent.click(screen.getByText('Имитировать сохранение'));
    await screen.findByText('Только что записанное');
    expect(mockApi.getSchemaDiary).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Закрыть быструю запись'));
    expect(screen.queryByTestId('quick-entry-sheet')).toBeNull();
  });
});

describe('DiarySection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('без записей показывает объясняющее пустое состояние с кнопкой «Записать» выше', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Пока ни одной записи')).toBeTruthy());
    expect(screen.getByText(/кнопка «Записать» выше/)).toBeTruthy();
    expect(screen.queryByText(/дней подряд|день подряд/)).toBeNull();
  });

  it('ошибка getSchemaDiary не роняет экран — остаётся пустое состояние', async () => {
    mockApi.getSchemaDiary.mockRejectedValue(new Error('network down'));
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());
    expect(screen.getByText('Пока ни одной записи')).toBeTruthy();
  });
});

describe('DiarySection — сбой загрузки (сбой ≠ пусто)', () => {
  // Регрессия: отказ загрузки раньше оставлял [] без объяснения — дневник
  // выглядел стёртым, хотя записи целы на сервере (пара к miniapp).
  it('провал загрузки показывает неблокирующий баннер, кнопка «Записать» остаётся', async () => {
    mockApi.getSchemaDiary.mockRejectedValue(new Error('network down'));
    renderSection();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить записи дневника/);
    expect(screen.getByRole('button', { name: 'Записать' })).toBeTruthy();
  });

  it('«Обновить» перезапрашивает записи и убирает баннер при успехе', async () => {
    mockApi.getSchemaDiary.mockRejectedValueOnce(new Error('network down'));
    renderSection();
    await screen.findByRole('alert');
    mockApi.getSchemaDiary.mockResolvedValueOnce([schemaEntry({ trigger: 'Загрузилось после повтора' })]);
    fireEvent.click(screen.getByText('Обновить'));
    await screen.findByText('Загрузилось после повтора');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('сбой истории трекера и профиля не роняет дневники', async () => {
    mockApi.history.mockRejectedValue(new Error('offline'));
    mockApi.getProfile.mockRejectedValue(new Error('network down'));
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Видно несмотря на сбой' })]);
    renderSection();
    await screen.findByText('Видно несмотря на сбой');
    expect(screen.queryByRole('alert')).toBeNull();
    // Сбой трекера ≠ «отметок нет»: об этом сказано, а «Повторить» перезапрашивает историю.
    expect(screen.getByRole('status').textContent).toMatch(/Отметки трекера не загрузились/);
    mockApi.history.mockResolvedValue([rated('2026-08-01', [8, 6, 7, 7, 8])]);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('Трекер — индекс 7,2');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('DiarySection — реальные записи из api', () => {
  it('показывает реальный триггер записи схемы, а не выдуманный текст', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Реальный триггер из API' })]);
    renderSection();
    await screen.findByText('Реальный триггер из API');
  });

  it('запись без схем и эмоций подписана «Мысль», запись со схемой — «Схема»', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([
      schemaEntry({ id: 2, trigger: 'Просто мысль дня' }),
      { ...schemaEntry({ id: 1, trigger: 'Разобранный момент' }), schemaIds: ['abandonment'] },
    ]);
    renderSection();
    const thought = (await screen.findByText('Просто мысль дня')).closest('.cd-entry') as HTMLElement;
    expect(thought.querySelector('.ds-chip')?.textContent).toBe('Мысль');
    const full = screen.getByText('Разобранный момент').closest('.cd-entry') as HTMLElement;
    expect(full.querySelector('.ds-chip')?.textContent).toBe('Схема');
  });

  it('запись благодарности показывает реальные пункты, а не заглушку', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ items: ['Утренний кофе', 'Звонок другу'] })]);
    renderSection();
    await screen.findByText('Утренний кофе');
    expect(screen.getByText('Звонок другу')).toBeTruthy();
  });
});

describe('DiarySection — сегмент «Все · Трекер · Случаи · Дневник»', () => {
  const setup = () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Запись-схема' })]);
    mockApi.getModeDiary.mockResolvedValue([modeEntry({ situation: 'Запись-режим' })]);
    mockApi.history.mockResolvedValue([rated('2026-08-01', [8, 6, 7, 7, 8]), rated('2026-07-31', [5, 5, 5])]);
  };

  it('счётчики: всего, дней трекера, записей дневника', async () => {
    setup();
    renderSection();
    await screen.findByText('Запись-схема');
    const counts = [...document.querySelectorAll('.ds-seg-btn')].map(b => b.textContent);
    expect(counts).toEqual(['Все4', 'Трекер2', 'Случаи0', 'Дневник2']);
  });

  it('в ленте за день — строка трекера: «индекс 7,2» при всех пяти оценках, «3 из 5» при неполных', async () => {
    setup();
    renderSection();
    await screen.findByText('Трекер — индекс 7,2');
    expect(screen.getByText('Трекер: 3 из 5')).toBeTruthy();
  });

  it('«Трекер» скрывает дневниковые записи, «Дневник» — строки трекера', async () => {
    setup();
    renderSection();
    await screen.findByText('Запись-схема');
    fireEvent.click(screen.getByRole('button', { name: /^Трекер/ }));
    expect(screen.queryByText('Запись-схема')).toBeNull();
    expect(screen.getByText('Трекер — индекс 7,2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Дневник/ }));
    expect(screen.getByText('Запись-схема')).toBeTruthy();
    expect(screen.getByText('Запись-режим')).toBeTruthy();
    expect(screen.queryByText('Трекер — индекс 7,2')).toBeNull();
  });

  it('«Случаи» показывает только разборы (fromCase), «Дневник» их не показывает', async () => {
    mockApi.getModeDiary.mockResolvedValue([
      modeEntry({ id: 1, situation: 'Обычная запись режима' }),
      { ...modeEntry({ id: 2, situation: 'Тишина в ответ' }), fromCase: true },
    ]);
    renderSection();
    await screen.findByText('Тишина в ответ');
    const counts = [...document.querySelectorAll('.ds-seg-btn')].map(b => b.textContent);
    expect(counts).toEqual(['Все2', 'Трекер0', 'Случаи1', 'Дневник1']);
    fireEvent.click(screen.getByRole('button', { name: /^Случаи/ }));
    expect(screen.getByText('Тишина в ответ')).toBeTruthy();
    expect(screen.queryByText('Обычная запись режима')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Дневник/ }));
    expect(screen.getByText('Обычная запись режима')).toBeTruthy();
    expect(screen.queryByText('Тишина в ответ')).toBeNull();
  });

  it('пустые «Случаи» — объяснение, что такое разбор и откуда его начать', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^Случаи/ }));
    await screen.findByText('Разборов пока нет');
    expect(screen.getByText(/плитка «Что случилось» на главной/)).toBeTruthy();
  });

  it('сегмент без записей своего типа — честное «пока нет», а не пустота', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^Трекер/ }));
    await screen.findByText('Отметок трекера пока нет');
  });

  it('тап по строке трекера открывает историю оценок', async () => {
    mockApi.history.mockResolvedValue([rated('2026-08-01', [8, 6, 7, 7, 8])]);
    const onOpenTrackerHistory = vi.fn();
    renderSection(onOpenTrackerHistory);
    fireEvent.click(await screen.findByText('Трекер — индекс 7,2'));
    expect(onOpenTrackerHistory).toHaveBeenCalledTimes(1);
  });

  it('история запрашивается на 30 дней — глубже бэкенд не отдаёт', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.history).toHaveBeenCalledWith(30));
  });

  it('«Дневник»: кнопка «Поделиться дневником» есть при записях; на «Все» её нет', async () => {
    setup();
    renderSection();
    await screen.findByText('Запись-схема');
    expect(screen.queryByLabelText('Поделиться дневником')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Дневник/ }));
    expect(screen.getByLabelText('Поделиться дневником')).toBeTruthy();
  });
});

describe('DiarySection — серия дней подряд (из профиля)', () => {
  it('под лентой: «5 дней подряд. Сбиться — не страшно.»', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    mockApi.getProfile.mockResolvedValue({ ysq: { activeSchemaIds: [] }, streak: 5 });
    renderSection();
    await screen.findByText('5 дней подряд. Сбиться — не страшно.');
  });

  it('серия 0 — строки нет; «1 день», «2 дня» склоняются', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    const { unmount } = renderSection();
    await screen.findByText('Коллега не ответил на сообщение');
    expect(screen.queryByText(/Сбиться — не страшно/)).toBeNull();
    unmount();
    mockApi.getProfile.mockResolvedValue({ ysq: { activeSchemaIds: [] }, streak: 1 });
    renderSection();
    await screen.findByText('1 день подряд. Сбиться — не страшно.');
  });
});

describe('DiarySection — удаление записи (с подтверждением)', () => {
  it('удаление требует подтверждения и вызывает api.deleteSchemaDiary только после второго клика', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ id: 42 })]);
    mockApi.deleteSchemaDiary.mockResolvedValue(undefined);
    renderSection();

    const entry = await screen.findByText('Коллега не ответил на сообщение');
    fireEvent.click(entry); // раскрыть карточку
    fireEvent.click(screen.getByText('Удалить'));
    expect(mockApi.deleteSchemaDiary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Удалить навсегда'));
    await waitFor(() => expect(mockApi.deleteSchemaDiary).toHaveBeenCalledWith(42));
    await waitFor(() => expect(screen.queryByText('Коллега не ответил на сообщение')).toBeNull());
  });

  it('"Отмена" в подтверждении удаления не вызывает api', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    renderSection();

    const entry = await screen.findByText('Коллега не ответил на сообщение');
    fireEvent.click(entry);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(mockApi.deleteSchemaDiary).not.toHaveBeenCalled();
    expect(screen.getByText('Коллега не ответил на сообщение')).toBeTruthy();
  });
});

describe('DiarySection — мастера по черновику («Продолжить →»)', () => {
  it('черновик схемы открывает лист схемы; сохранение добавляет запись и закрывает лист (read-after-write)', async () => {
    saveDraft('schema', { trigger: 'Черновик-триггер' });
    mockApi.createSchemaDiary.mockResolvedValue(schemaEntry({ id: 99, trigger: 'Новый триггер' }));
    renderSection();
    fireEvent.click(await screen.findByText('Продолжить →'));
    fireEvent.click(await screen.findByText('Сохранить схему'));
    await waitFor(() => expect(screen.queryByTestId('schema-entry-sheet')).toBeNull());
    await screen.findByText('Новый триггер');
    clearDraft('schema');
  });

  it('черновик режима открывает лист режима, сохранение добавляет запись', async () => {
    saveDraft('mode', { situation: 'Черновик-ситуация' });
    mockApi.createModeDiary.mockResolvedValue(modeEntry({ id: 98, situation: 'Новая ситуация' }));
    renderSection();
    fireEvent.click(await screen.findByText('Продолжить →'));
    await screen.findByTestId('mode-entry-sheet');
    fireEvent.click(screen.getByText('Сохранить режим'));
    await waitFor(() => expect(screen.queryByTestId('mode-entry-sheet')).toBeNull());
    await screen.findByText('Новая ситуация');
    clearDraft('mode');
  });

  it('черновик благодарности: лист открывается с пунктами сегодняшнего дня (existingItems), сохранение добавляет запись', async () => {
    saveDraft('gratitude', { items: ['Черновик-пункт'] });
    // «Сегодня» дневника — местный день (shared/src/diary/diaryDay.ts), не UTC.
    const today = todayStr();
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ date: today, items: ['Уже записано'] })]);
    mockApi.createGratitudeDiary.mockResolvedValue(gratitudeEntry({ id: 97, date: today, items: ['Новый пункт'] }));
    renderSection();
    await screen.findByText('Уже записано');
    fireEvent.click(await screen.findByText('Продолжить →'));
    expect((await screen.findByTestId('gratitude-existing')).textContent).toBe(JSON.stringify(['Уже записано']));
    fireEvent.click(screen.getByText('Сохранить благодарность'));
    await waitFor(() => expect(screen.queryByTestId('gratitude-entry-sheet')).toBeNull());
    await screen.findByText('Новый пункт');
    // base листа доходит до API: сервер сливает сохранение с днём, а не заменяет его.
    expect(mockApi.createGratitudeDiary).toHaveBeenCalledWith(today, ['Новый пункт'], ['Уже записано']);
    clearDraft('gratitude');
  });

  it('закрытие листа без сохранения возвращает на ленту (архив не меняется)', async () => {
    saveDraft('schema', { trigger: 'Черновик-триггер' });
    renderSection();
    fireEvent.click(await screen.findByText('Продолжить →'));
    fireEvent.click(await screen.findByText('Закрыть лист схемы'));
    await waitFor(() => expect(screen.queryByTestId('schema-entry-sheet')).toBeNull());
    expect(mockApi.createSchemaDiary).not.toHaveBeenCalled();
    clearDraft('schema');
  });

  it('удаление черновика (× затем подтверждение) убирает баннер', async () => {
    saveDraft('schema', { trigger: 'Черновик-триггер' });
    renderSection();
    await screen.findByText('Продолжить →');
    fireEvent.click(screen.getByLabelText('Удалить черновик'));
    fireEvent.click(screen.getByText('удалить'));
    await waitFor(() => expect(screen.queryByText('Продолжить →')).toBeNull());
    clearDraft('schema');
  });
});

describe('DiarySection — удаление записей режима и благодарности', () => {
  it('удаление записи режима убирает её из списка', async () => {
    mockApi.getModeDiary.mockResolvedValue([modeEntry({ id: 55, situation: 'Критика на работе' })]);
    mockApi.deleteModeDiary.mockResolvedValue(undefined);
    renderSection();

    const entry = await screen.findByText('Критика на работе');
    fireEvent.click(entry);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Удалить навсегда'));

    await waitFor(() => expect(mockApi.deleteModeDiary).toHaveBeenCalledWith(55));
    await waitFor(() => expect(screen.queryByText('Критика на работе')).toBeNull());
  });

  it('удаление записи благодарности убирает её из списка', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ id: 33, items: ['Удаляемый пункт'] })]);
    mockApi.deleteGratitudeDiary.mockResolvedValue(undefined);
    renderSection();

    const entry = await screen.findByText('Удаляемый пункт');
    fireEvent.click(entry);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Удалить навсегда'));

    await waitFor(() => expect(mockApi.deleteGratitudeDiary).toHaveBeenCalledWith(33));
    await waitFor(() => expect(screen.queryByText('Удаляемый пункт')).toBeNull());
  });
});

describe('DiarySection — группировка по дате', () => {
  it('группа сегодняшних записей помечена "сегодня"', async () => {
    const today = new Date().toISOString();
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ createdAt: today })]);
    renderSection();

    // «сегодня · понедельник» рендерится как два соседних текстовых узла —
    // ищем по содержимому родителя, а не по одному узлу.
    await waitFor(() => {
      const rel = document.querySelector('.cd-day-rel');
      expect(rel?.textContent).toContain('сегодня');
    });
  });
});

// Инцидент 2026-10-26: «сегодня» дневника было гринвичским днём на момент
// загрузки бандла. Благодарность, записанная в 00:19 по Москве, получала 26.10,
// а архив подписывал запись вторника «сегодня · понедельник».
describe('DiarySection — «сегодня» по местному дню, а не по UTC', () => {
  const NIGHT = new Date('2026-10-26T21:19:00Z'); // 00:19 27.10 по Москве
  let prevTz: string | undefined;
  beforeEach(() => {
    prevTz = process.env.TZ;
    process.env.TZ = 'Europe/Moscow';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NIGHT);
  });
  afterEach(() => {
    vi.useRealTimers();
    clearDraft('gratitude');
    if (prevTz === undefined) delete process.env.TZ;
    else process.env.TZ = prevTz;
  });

  it('благодарность в 00:19 по Москве сохраняется датой 27-го', async () => {
    saveDraft('gratitude', { items: ['Черновик-пункт'] });
    mockApi.createGratitudeDiary.mockResolvedValue(gratitudeEntry({ id: 5, date: '2026-10-27', items: ['Новый пункт'] }));
    renderSection();
    fireEvent.click(await screen.findByText('Продолжить →'));
    fireEvent.click(await screen.findByText('Сохранить благодарность'));
    await waitFor(() => expect(mockApi.createGratitudeDiary).toHaveBeenCalledWith('2026-10-27', ['Новый пункт'], []));
  });

  it('уже записанная за 27-е благодарность открывается своими пунктами, вчерашняя — нет', async () => {
    saveDraft('gratitude', { items: ['Черновик-пункт'] });
    mockApi.getGratitudeDiary.mockResolvedValue([
      gratitudeEntry({ id: 2, date: '2026-10-27', items: ['Чай с мятой'] }),
      gratitudeEntry({ id: 1, date: '2026-10-26', items: ['Вчерашнее'] }),
    ]);
    renderSection();
    await screen.findByText('Чай с мятой');
    fireEvent.click(await screen.findByText('Продолжить →'));
    expect((await screen.findByTestId('gratitude-existing')).textContent).toBe(JSON.stringify(['Чай с мятой']));
  });

  it('лента: запись схемы в 00:19 и благодарность 27-го — одна группа «27 октября · сегодня · вторник»', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ id: 3, date: '2026-10-27', items: ['Тёплый плед'] })]);
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ id: 4, createdAt: NIGHT.toISOString() })]);
    renderSection();
    await screen.findByText('Тёплый плед');
    const days = [...document.querySelectorAll('.cd-day-date')].map((n) => n.textContent);
    expect(days).toEqual(['27 октября']);
    expect(document.querySelector('.cd-day-rel')?.textContent).toBe('сегодня · вторник');
  });
});
