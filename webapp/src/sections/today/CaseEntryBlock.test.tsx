// @vitest-environment jsdom
// CaseEntryBlock — точка входа «Что это было» на /today + условный показ
// онбординга «С чего начать» (только после первого разбора, правило CLAUDE.md
// «одно очевидное действие на экран у новичка»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CaseEntryBlock } from './CaseEntryBlock';
import type { UserProfile } from '../../types';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn(),
    getModeNotes: vi.fn().mockResolvedValue([]),
    getProfile: vi.fn(),
    createModeDiary: vi.fn().mockResolvedValue({}),
    saveModeNote: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function profile(): UserProfile {
  return {
    name: null,
    role: 'CLIENT',
    ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: 0,
    lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
    mySchemaIds: [],
    myModeIds: [],
  };
}

function noopProps() {
  return {
    profile: profile(),
    hasSchemas: false,
    onOpenSchema: vi.fn(),
    onOpenAdvanced: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
  };
}

function renderBlock(overrides: Partial<ReturnType<typeof noopProps>> = {}) {
  return render(
    <MemoryRouter>
      <CaseEntryBlock {...noopProps()} {...overrides} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Карта себя (useSelfMapData) читает getModeNotes/getProfile тоже — оба
  // должны резолвиться, даже когда тест открывает только карточку разбора и
  // карту не трогает, иначе Promise.all повиснет на undefined.ysq.
  mockApi.getModeNotes.mockResolvedValue([]);
  mockApi.getProfile.mockResolvedValue({ ysq: { completedAt: null } });
});
afterEach(() => cleanup());

describe('CaseEntryBlock — у новичка одно главное действие, без чеклиста', () => {
  it('caseCount=0: карточка "Что это было", онбординг-чеклист не показан', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock();

    await screen.findByText('Что это было');
    expect(screen.getByText('Разобрать · ≈ 3 мин')).toBeTruthy();
    expect(screen.getByText('Ровный день')).toBeTruthy();
    expect(screen.queryByText('С чего начать')).toBeNull();
    expect(screen.queryByText(/Карта себя/)).toBeNull();
  });
});

describe('CaseEntryBlock — после первого разбора чеклист появляется', () => {
  it('caseCount>0: карточка меняет текст, показывает карту, онбординг виден', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    renderBlock();

    await screen.findByText('Что сегодня зацепило?');
    await screen.findByText(/Карта себя · 2 разбора/);
    await screen.findByText('С чего начать');
  });
});

describe('CaseEntryBlock — кнопки', () => {
  it('«Разобрать · ≈ 3 мин» открывает поток разбора', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock();
    await screen.findByText('Что это было');

    fireEvent.click(screen.getByText('Разобрать · ≈ 3 мин'));
    await waitFor(() => expect(screen.getByText('Что сегодня зацепило?')).toBeTruthy());
  });

  it('«Ровный день» вызывает onOpenTracker напрямую, не открывая поток', async () => {
    const onOpenTracker = vi.fn();
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock({ onOpenTracker });
    await screen.findByText('Что это было');

    fireEvent.click(screen.getByText('Ровный день'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Что сегодня зацепило?')).toBeNull();
  });
});

const SCENE_TEXT = 'Мама позвонила и стала расспрашивать про работу';
const SCENE_PLACEHOLDER = /сообщение прочитано час назад/i;

describe('CaseEntryBlock — карта себя открывается лениво из «Карта себя»', () => {
  it('«Карта себя» открывает карту, «что дальше» с карты уводит обратно в разбор', async () => {
    // Один случай — CaseEntryCard уже показывает «Карта себя», а карта
    // (useSelfMapData) видит один разбор одного режима: модель «что дальше»
    // предложит «ещё один случай», не «первый разбор».
    mockApi.getModeDiary.mockResolvedValue([
      { modeId: 'detached_protector', createdAt: new Date().toISOString() },
    ]);
    renderBlock();
    await screen.findByText(/Карта себя · 1 разбор/);

    fireEvent.click(screen.getByText(/Карта себя · 1 разбор/));
    await screen.findByText(/Черновик/);

    fireEvent.click(screen.getByText('Разобрать ещё один случай'));
    // карта закрылась, поток разбора открылся с самого начала (hook)
    await screen.findByText('Разобрать свой случай');
    expect(screen.queryByText(/Черновик/)).toBeNull();
  });

  it('«Закрыть» на карте возвращает на /today без открытия потока', async () => {
    mockApi.getModeDiary.mockResolvedValue([
      { modeId: 'detached_protector', createdAt: new Date().toISOString() },
    ]);
    renderBlock();
    await screen.findByText(/Карта себя · 1 разбор/);

    fireEvent.click(screen.getByText(/Карта себя · 1 разбор/));
    await screen.findByText(/Черновик/);

    fireEvent.click(screen.getByText('Закрыть'));
    expect(screen.queryByText(/Черновик/)).toBeNull();
    expect(screen.queryByText('Разобрать свой случай')).toBeNull();
  });
});

describe('CaseEntryBlock — полный проход доезжает до реального API', () => {
  it('onSave/onSaveCard зовут api.createModeDiary/saveModeNote, «Открыть карту» открывает карту', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock();
    await screen.findByText('Что это было');

    fireEvent.click(screen.getByText('Разобрать · ≈ 3 мин'));
    await screen.findByText('Разобрать свой случай');
    fireEvent.click(screen.getByText('Разобрать свой случай'));

    fireEvent.change(screen.getByPlaceholderText(SCENE_PLACEHOLDER), {
      target: { value: SCENE_TEXT },
    });
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    fireEvent.click(screen.getByText('Сердце колотится'));
    fireEvent.click(screen.getByText('Дальше')); // тело -> порыв
    fireEvent.click(screen.getByText('Свернуть разговор'));
    fireEvent.click(screen.getByText('Дальше')); // порыв -> критерий

    fireEvent.click(screen.getAllByText('Да')[0]);
    fireEvent.click(screen.getAllByText('Нет')[1]); // вердикт «часть»
    fireEvent.click(screen.getByText('Дальше'));

    await waitFor(() => expect(mockApi.createModeDiary).toHaveBeenCalledTimes(1));
    expect(mockApi.createModeDiary).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'vulnerable_child', situation: SCENE_TEXT }),
    );

    await screen.findByText('Вот что произошло');
    fireEvent.click(screen.getByText('Дальше')); // recognition -> name
    fireEvent.click(screen.getByText('Стена'));

    await waitFor(() => expect(mockApi.saveModeNote).toHaveBeenCalledTimes(1));
    expect(mockApi.saveModeNote).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'vulnerable_child', alias: 'Стена' }),
    );

    await screen.findByText('Открыть карту');
    fireEvent.click(screen.getByText('Открыть карту'));
    // поток закрылся, открылась карта с только что сохранённым разбором
    await screen.findByText(/Черновик/);
    expect(screen.queryByText('Открыть карту')).toBeNull();
  });

  it('«Дописать потом» закрывает поток и перечитывает счётчик разборов', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderBlock();
    await screen.findByText('Что это было');

    fireEvent.click(screen.getByText('Разобрать · ≈ 3 мин'));
    await screen.findByText('Разобрать свой случай');
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    fireEvent.change(screen.getByPlaceholderText(SCENE_PLACEHOLDER), {
      target: { value: SCENE_TEXT },
    });

    mockApi.getModeDiary.mockResolvedValue([
      { modeId: 'detached_protector', createdAt: new Date().toISOString() },
    ]);
    fireEvent.click(screen.getByText('Дописать потом'));

    // поток закрылся; load() перечитал count — карточка теперь «после разбора»
    await screen.findByText('Что сегодня зацепило?');
    expect(screen.queryByText('Что случилось?')).toBeNull();
    expect(mockApi.getModeDiary).toHaveBeenCalledTimes(2); // при монтаже + после close
  });
});
