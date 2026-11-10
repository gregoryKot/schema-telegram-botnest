// @vitest-environment jsdom
// SchemaDetailSheet — было 4% покрытия (27 непокрытых строк). Проверяем:
// рендер описания/убеждений схемы, добавление/удаление в «мои схемы»
// (localStorage + api.updateSettings синхронно — денормализованное поле,
// правило CLAUDE.md №4), переход к упражнению «Познакомиться» и открытие
// карточки для «Поделиться». useHistorySheet — образец теста:
// useHistorySheet.test.tsx (MemoryRouter обязателен для useNavigate/useLocation).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaDetailSheet } from './SchemaDetailSheet';
import { MY_SCHEMA_IDS_KEY } from '../utils/storageKeys';

vi.mock('../api', () => ({
  api: {
    updateSettings: vi.fn().mockResolvedValue(undefined),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
import { plainText } from '../test-support/plainText';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet(schemaId = 'emotional_deprivation', onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <SchemaDetailSheet schemaId={schemaId} onClose={onClose} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => cleanup());

describe('SchemaDetailSheet — рендер', () => {
  it('показывает домен, название и типичные убеждения схемы', () => {
    renderSheet();
    // «Нарушение связи и отвержение» встречается дважды: eyebrow экрана и
    // заголовок aside-карточки «Домен» — оба легитимны, проверяем что есть.
    expect(
      screen.getAllByText('Нарушение связи и отвержение').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Эмоциональная депривация')).toBeTruthy();
    expect(screen.getByText('Типичные убеждения')).toBeTruthy();
    expect(
      screen.getByText('«Никто никогда по-настоящему не позаботится обо мне»'),
    ).toBeTruthy();
  });

  it('неизвестный schemaId — компонент не падает и ничего не рендерит', () => {
    const { container } = renderSheet('not-a-real-schema');
    expect(container.textContent).toBe('');
  });
});

describe('SchemaDetailSheet — «в мои схемы» (денормализованное поле)', () => {
  it('изначально не добавлена: кнопка предлагает добавить', () => {
    renderSheet();
    expect(screen.getAllByText('+ В мои схемы').length).toBeGreaterThan(0);
  });

  it('уже в localStorage — кнопка сразу показывает «В моих схемах»', () => {
    localStorage.setItem(
      MY_SCHEMA_IDS_KEY,
      JSON.stringify(['emotional_deprivation']),
    );
    renderSheet();
    expect(screen.getAllByText('В моих схемах').length).toBeGreaterThan(0);
  });

  it('добавление: localStorage и api.updateSettings обновляются одинаковым списком', () => {
    renderSheet();
    const [addButton] = screen.getAllByText('+ В мои схемы');
    fireEvent.click(addButton);

    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]')).toEqual(
      ['emotional_deprivation'],
    );
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      mySchemaIds: ['emotional_deprivation'],
    });
    expect(screen.getAllByText('В моих схемах').length).toBeGreaterThan(0);
  });

  it('повторный клик убирает схему из списка (localStorage и api синхронно)', () => {
    localStorage.setItem(
      MY_SCHEMA_IDS_KEY,
      JSON.stringify(['emotional_deprivation', 'mistrust']),
    );
    renderSheet();
    const [removeButton] = screen.getAllByText('В моих схемах');
    fireEvent.click(removeButton);

    expect(JSON.parse(localStorage.getItem(MY_SCHEMA_IDS_KEY) ?? '[]')).toEqual(
      ['mistrust'],
    );
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      mySchemaIds: ['mistrust'],
    });
  });
});

// docs/open/frontend-ux.md: `.catch(() => {})` глушил отказ записи, включая
// 409 «не читается» — человек не узнавал, что выбор не сохранился на сервере.
describe('SchemaDetailSheet — отказ записи «в мои схемы» виден', () => {
  const addSchema = () => fireEvent.click(screen.getAllByText('+ В мои схемы')[0]);

  it('409 unreadable_data: плашка «прежний список не читается», без «проверь связь»', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(
      Object.assign(new Error('Conflict'), { status: 409, reason: 'unreadable_data' }),
    );
    renderSheet();
    addSchema();
    const alert = await screen.findByRole('alert');
    expect(plainText(alert)).toMatch(/прежний список сейчас не читается/);
    expect(alert.textContent).not.toMatch(/проверь связь/);
    // Выбор остался на устройстве — экран не врёт про локальное состояние.
    expect(screen.getAllByText('В моих схемах').length).toBeGreaterThan(0);
  });

  it('обрыв сети: плашка «сохранён только на этом устройстве»', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderSheet();
    addSchema();
    expect(plainText((await screen.findByRole('alert')))).toMatch(/только на этом устройстве — проверь связь/);
  });

  // Ревью g5 r1: «попробуй ещё раз» без кнопки, а повторный тап по чипу снимал выбор. Теперь — знак домена и
  // «Повторить» тем же списком, как на «Паттернах».
  it('обрыв сети → «Повторить» шлёт тот же список, выбор не снимается; удача убирает плашку', async () => {
    mockApi.updateSettings.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderSheet();
    addSchema();
    const alert = await screen.findByRole('alert');
    expect(alert.querySelector('.pa-alert-sign')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(mockApi.updateSettings).toHaveBeenCalledTimes(2);
    expect(mockApi.updateSettings).toHaveBeenLastCalledWith({ mySchemaIds: ['emotional_deprivation'] });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getAllByText('В моих схемах').length).toBeGreaterThan(0);
  });

  it('успех: плашки нет', async () => {
    renderSheet();
    addSchema();
    await waitFor(() => expect(mockApi.updateSettings).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// Регрессия: onClick звал onClose() ЯВНО и одновременно navigate() — а
// navigate() меняет location, что заставляет useHistorySheet саму поймать
// несовпадение __sheetId и позвать onClose() ЕЩЁ раз. Итог — onClose
// срабатывал дважды на один клик (двойной вызов родительского закрытия
// листа). Тест ловит именно кратность вызова, а не факт вызова вообще.
describe('SchemaDetailSheet — «Познакомиться →» закрывает лист ровно один раз', () => {
  it('onClose вызывается один раз (не дважды) на клик', () => {
    const onClose = vi.fn();
    renderSheet('emotional_deprivation', onClose);
    const [goButton] = screen.getAllByText('Познакомиться →');
    fireEvent.click(goButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SchemaDetailSheet — «Поделиться» открывает карточку', () => {
  it('клик открывает ShareCardSheet с заголовком «Карточка схемы»', () => {
    renderSheet();
    const [shareButton] = screen.getAllByText('Поделиться');
    fireEvent.click(shareButton);
    expect(screen.getByText('Карточка схемы')).toBeTruthy();
  });
});
