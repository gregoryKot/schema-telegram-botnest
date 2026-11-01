// @vitest-environment jsdom
// Кризисная детекция в дневнике благодарности (CLAUDE.md, правило №7):
// detectCrisisAny(...items) — проверка по всем пунктам, а не только по первому.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GratitudeEntrySheet } from './GratitudeEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn(), getGratitudeDiary: vi.fn() },
}));

function renderSheet() {
  return render(
    <MemoryRouter>
      <GratitudeEntrySheet
        onClose={vi.fn()}
        date="2026-07-20"
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.getGratitudeDiary).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('GratitudeEntrySheet — кризисная детекция', () => {
  it('кризисная фраза в одном из пунктов показывает CrisisCard', async () => {
    renderSheet();
    const textarea = await screen.findByPlaceholderText(
      'Что-то хорошее, что произошло сегодня…',
    );
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', async () => {
    renderSheet();
    const textarea = await screen.findByPlaceholderText(
      'Что-то хорошее, что произошло сегодня…',
    );
    fireEvent.change(textarea, { target: { value: 'Тёплый чай вечером' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// В7 дизайн-аудита 2026-08: каждый пункт связан со своим вопросом через
// aria-label, а не только через исчезающий при вводе placeholder.
describe('GratitudeEntrySheet — поля связаны с вопросом (В7)', () => {
  it('каждое поле доступно по своему вопросу как по label', async () => {
    renderSheet();
    const first = await screen.findByLabelText(/Пункт 1: Что-то хорошее/);
    const second = screen.getByLabelText(/Пункт 2: Кто-то, кто помог/);
    expect(first).toBe(
      screen.getByPlaceholderText('Что-то хорошее, что произошло сегодня…'),
    );
    expect(second).toBe(
      screen.getByPlaceholderText('Кто-то, кто помог или поддержал…'),
    );
  });
});

// Инцидент 2026-10-18 (docs/INCIDENTS.md): сервер хранит ОДНУ запись благодарности
// на день и каждым сохранением заменяет пункты целиком. Форма, открытая без
// existingItems (вход из «плюса»), стартовала пустой, и вторая запись за день
// стирала первую. Инвариант держит сама форма.
describe('GratitudeEntrySheet — сохранённый день не затирается (инцидент 2026-10-18)', () => {
  const saved = {
    id: 1,
    date: '2026-07-20',
    items: ['Утренний кофе', 'Звонок маме'],
    createdAt: '2026-07-20T08:00:00.000Z',
  };

  it('открыта без existingItems → показывает сохранённые пункты → onSave получает старые + новый', async () => {
    vi.mocked(api.getGratitudeDiary).mockResolvedValue([saved]);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <GratitudeEntrySheet
          onClose={vi.fn()}
          date="2026-07-20"
          onSave={onSave}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByDisplayValue('Утренний кофе')).toBeTruthy();
    expect(screen.getByDisplayValue('Звонок маме')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Пункт 3:/), {
      target: { value: 'Вечерняя прогулка' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
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
    renderSheet();
    await screen.findByLabelText(/Пункт 1:/);
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
    renderSheet();
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
    renderSheet();
    expect(screen.queryByLabelText(/Пункт 1:/)).toBeNull();
    expect(screen.getByLabelText('Загружаю сегодняшние записи')).toBeTruthy();
    const save = screen.getByRole('button', {
      name: /Сохранить/,
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    resolve([]);
    expect(await screen.findByLabelText(/Пункт 1:/)).toBeTruthy();
  });

  it('сбой загрузки: видна ошибка, сохранить нельзя, «Повторить» поднимает запись', async () => {
    vi.mocked(api.getGratitudeDiary)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([saved]);
    renderSheet();
    expect(
      await screen.findByText(/Не получилось загрузить записи за сегодня/),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/Пункт 1:/)).toBeNull();
    expect(
      (screen.getByRole('button', { name: /Сохранить/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByDisplayValue('Утренний кофе')).toBeTruthy();
    expect(
      screen.queryByText(/Не получилось загрузить записи за сегодня/),
    ).toBeNull();
  });

  it('existingItems переданы — запись не запрашивается', () => {
    render(
      <MemoryRouter>
        <GratitudeEntrySheet
          onClose={vi.fn()}
          date="2026-07-20"
          existingItems={['А']}
          onSave={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByDisplayValue('А')).toBeTruthy();
    expect(api.getGratitudeDiary).not.toHaveBeenCalled();
  });
});
