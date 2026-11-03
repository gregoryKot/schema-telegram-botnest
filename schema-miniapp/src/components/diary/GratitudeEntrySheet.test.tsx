// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник благодарности — свободнотекстовые пункты,
// тот же паттерн детекции. Тестов на него раньше не было.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { GratitudeEntrySheet } from './GratitudeEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn(), getGratitudeDiary: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getGratitudeDiary).mockReset();
  vi.mocked(api.getGratitudeDiary).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

function renderSheet() {
  render(
    <GratitudeEntrySheet
      onClose={() => {}}
      date="2026-07-20"
      existingItems={['', '', '']}
      onSave={vi.fn()}
    />,
  );
  return screen.getByPlaceholderText(
    'Что-то хорошее, что произошло сегодня...',
  );
}

describe('GratitudeEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в одном из пунктов', () => {
    const first = renderSheet();
    fireEvent.change(first, { target: { value: 'хочу исчезнуть' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const first = renderSheet();
    fireEvent.change(first, { target: { value: 'сегодня гулял в парке' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});

// Инцидент 2026-10-18 (docs/INCIDENTS.md): сервер хранит ОДНУ запись благодарности
// на день и каждым сохранением заменяет пункты целиком. Вход из «плюса» открывал
// форму без existingItems — она стартовала пустой, и вторая запись за день стирала
// первую. Инвариант держит сама форма, а не точка входа.
describe('GratitudeEntrySheet — сохранённый день не затирается (инцидент 2026-10-18)', () => {
  const saved = {
    id: 1,
    date: '2026-07-20',
    items: ['Утренний кофе', 'Звонок маме'],
    createdAt: '2026-07-20T08:00:00.000Z',
  };
  const open = (onSave = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <GratitudeEntrySheet
        onClose={() => {}}
        date="2026-07-20"
        onSave={onSave}
      />,
    );
    return onSave;
  };
  const saveButton = () => screen.getByRole('button', { name: /Сохранить/ });

  it('открыта без existingItems → показывает сохранённые пункты → onSave получает старые + новый', async () => {
    vi.mocked(api.getGratitudeDiary).mockResolvedValue([saved]);
    const onSave = open();
    expect(await screen.findByDisplayValue('Утренний кофе')).toBeTruthy();
    expect(screen.getByDisplayValue('Звонок маме')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Благодарность 3'), {
      target: { value: 'Вечерняя прогулка' },
    });
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // Третий аргумент — день, с которого форма начала: с ним сервер сливает запись.
    expect(onSave).toHaveBeenCalledWith(
      '2026-07-20',
      ['Утренний кофе', 'Звонок маме', 'Вечерняя прогулка'],
      ['Утренний кофе', 'Звонок маме'],
    );
  });

  it('запись другого дня не подмешивается', async () => {
    vi.mocked(api.getGratitudeDiary).mockResolvedValue([
      { ...saved, date: '2026-07-19' },
    ]);
    open();
    await screen.findByLabelText('Благодарность 1');
    expect(screen.queryByDisplayValue('Утренний кофе')).toBeNull();
  });

  it('новые пункты черновика дописываются к сохранённой записи', async () => {
    vi.mocked(api.getGratitudeDiary).mockResolvedValue([saved]);
    localStorage.setItem(
      'diary_draft_gratitude',
      JSON.stringify({
        startedAt: '2026-07-20T09:00:00.000Z',
        data: { items: ['Звонок маме', 'Черновик вечера'] },
      }),
    );
    open();
    expect(await screen.findByDisplayValue('Черновик вечера')).toBeTruthy();
    expect(screen.getAllByDisplayValue('Звонок маме')).toHaveLength(1);
  });

  it('пока записи грузятся, полей нет и сохранить нельзя', async () => {
    let resolve!: (v: unknown[]) => void;
    vi.mocked(api.getGratitudeDiary).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );
    open();
    expect(screen.queryByLabelText('Благодарность 1')).toBeNull();
    expect(screen.getByLabelText('Загружаю сегодняшние записи')).toBeTruthy();
    expect(saveButton()).toHaveProperty('disabled', true);
    resolve([]);
    expect(await screen.findByLabelText('Благодарность 1')).toBeTruthy();
  });

  it('сбой загрузки: видна ошибка, сохранить нельзя, «Повторить» поднимает запись', async () => {
    vi.mocked(api.getGratitudeDiary)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([saved]);
    open();
    expect(
      await screen.findByText(/Не получилось загрузить записи за сегодня/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Благодарность 1')).toBeNull();
    expect(saveButton()).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByDisplayValue('Утренний кофе')).toBeTruthy();
    expect(
      screen.queryByText(/Не получилось загрузить записи за сегодня/),
    ).toBeNull();
  });

  it('existingItems переданы — запись не запрашивается', () => {
    render(
      <GratitudeEntrySheet
        onClose={() => {}}
        date="2026-07-20"
        existingItems={['А']}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('А')).toBeTruthy();
    expect(api.getGratitudeDiary).not.toHaveBeenCalled();
  });
});
