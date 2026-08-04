// @vitest-environment jsdom
// HelpSection — экран «Здесь и сейчас» (0% покрытия): три параллельные
// загрузки (счётчики практик/задачи+история/статус терапии), кризисный вход
// «Мне очень плохо» (правило №7 — карточка с телефоном доверия ДОЛЖНА быть
// доступна с этого экрана), баннер терапевтических задач и роутинг open-task
// по типу задачи. Дочерние листы (у каждого свой тест) — мокаем.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { HelpSection } from './HelpSection';
import type { UserTask, TherapyRelationInfo } from '../apiTypes';

vi.mock('../api', () => ({
  api: {
    getPracticeSessions: vi.fn(),
    getTasks: vi.fn(),
    getTaskHistory: vi.fn(),
    getTherapyRelation: vi.fn(),
    completeTask: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../components/BreathingCard', () => ({
  BreathingCard: () => <div data-testid="breathing-card" />,
}));
vi.mock('../components/SchemaFlashcard', () => ({
  SchemaFlashcard: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="flashcard">
      <button onClick={onClose}>flashcard-close</button>
    </div>
  ),
}));
vi.mock('../components/BeliefCheck', () => ({
  BeliefCheck: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="belief-check">
      <button onClick={onClose}>belief-close</button>
    </div>
  ),
}));
vi.mock('../components/LetterToSelf', () => ({
  LetterToSelf: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="letter-to-self">
      <button onClick={onClose}>letter-close</button>
    </div>
  ),
}));
vi.mock('../components/SafePlace', () => ({
  SafePlace: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="safe-place">
      <button onClick={onClose}>safe-place-close</button>
    </div>
  ),
}));
vi.mock('../components/WarmWords', () => ({
  WarmWords: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="warm-words">
      <button onClick={onClose}>warm-words-close</button>
    </div>
  ),
}));
vi.mock('../components/SchemaIntroSheet', () => ({
  SchemaIntroSheet: ({ schemaId }: { schemaId: string }) => (
    <div data-testid="schema-intro">schema={schemaId}</div>
  ),
}));
vi.mock('../components/ModeIntroSheet', () => ({
  ModeIntroSheet: ({ modeId }: { modeId: string }) => (
    <div data-testid="mode-intro">mode={modeId}</div>
  ),
}));
vi.mock('../components/SelfHelpDisclaimer', () => ({
  SelfHelpSheet: ({ onOpenCrisis }: { onOpenCrisis: () => void }) => (
    <div data-testid="self-help">
      <button onClick={onOpenCrisis}>self-help-open-crisis</button>
    </div>
  ),
}));
vi.mock('../components/QuickPracticeSheet', () => ({
  QuickPracticeSheet: ({ id }: { id: string }) => (
    <div data-testid="quick-practice">id={id}</div>
  ),
}));
vi.mock('../components/TaskCreateSheet', async (importOriginal) => {
  // getTaskDisplayText нужен реальным TaskRow-строкам (taskEmoji.ts его
  // импортирует отсюда же) — подменяем только сам компонент листа.
  const actual =
    await importOriginal<typeof import('../components/TaskCreateSheet')>();
  return {
    ...actual,
    TaskCreateSheet: ({ onCreated }: { onCreated: () => void }) => (
      <div data-testid="task-create">
        <button onClick={onCreated}>task-create-created</button>
      </div>
    ),
  };
});

// Даты — относительные к моменту запуска (не литералы): NextSessionBanner
// сравнивает дату встречи с «сегодня», литерал в прошлом рано или поздно
// станет «сегодня» или «прошедшей датой» и незаметно сменит проверяемую ветку.
const DAY = 24 * 60 * 60 * 1000;
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}
function isoDateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

function task(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'custom',
    text: 'Задача',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: isoDaysAgo(2),
    ...overrides,
  };
}

function baseProps() {
  return {
    onOpenChildhoodWheel: vi.fn(),
    onOpenPractices: vi.fn(),
    onOpenPlans: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenDiaries: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getPracticeSessions.mockResolvedValue({});
  mockApi.getTasks.mockResolvedValue([]);
  mockApi.getTaskHistory.mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
});
afterEach(cleanup);

async function renderReady(
  props: Partial<Parameters<typeof HelpSection>[0]> = {},
) {
  const utils = render(<HelpSection {...baseProps()} {...props} />);
  await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  return utils;
}

describe('HelpSection — кризисный вход (правило №7)', () => {
  it('«Мне очень плохо» открывает лист с реальной кризисной карточкой и телефоном 112', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Мне очень плохо'));
    await screen.findByText('Помощь рядом');
    expect(screen.getByText(/112/)).toBeTruthy();
  });

  it('из листа «О границах самопомощи» тоже можно перейти в кризисную карточку', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('О границах самопомощи'));
    fireEvent.click(await screen.findByText('self-help-open-crisis'));
    await screen.findByText('Помощь рядом');
  });
});

describe('HelpSection — загрузка счётчиков и задач при монтировании', () => {
  it('запрашивает практики, задачи, историю и статус терапии', async () => {
    await renderReady();
    expect(mockApi.getPracticeSessions).toHaveBeenCalled();
    expect(mockApi.getTasks).toHaveBeenCalled();
    expect(mockApi.getTaskHistory).toHaveBeenCalled();
    expect(mockApi.getTherapyRelation).toHaveBeenCalled();
  });

  it('реальный счётчик пройденных практик заземления виден в подписи (не заглушка)', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({ grounding: 3 });
    await renderReady();
    await screen.findByText(/3 раза/);
  });
});

describe('HelpSection — задачи от терапевта', () => {
  it('без назначенных задач баннер «От терапевта» не рендерится', async () => {
    await renderReady();
    expect(screen.queryByText('От терапевта')).toBeNull();
  });

  it('с невыполненной сегодня задачей терапевта баннер виден', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 9, assignedBy: 5, type: 'belief_check', doneToday: false }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
  });
});

describe('HelpSection — инструменты открывают правильные листы', () => {
  // Каждая строка инструмента — свой обработчик setShowX(true); таблица
  // бьёт по всем разом вместо четырёх почти одинаковых it-блоков.
  it.each([
    ['Проверка убеждений', 'belief-check'],
    ['Безопасное место', 'safe-place'],
    ['Письмо себе', 'letter-to-self'],
    ['Тёплые слова', 'warm-words'],
  ])('«%s» открывает свой лист', async (label, testId) => {
    await renderReady();
    fireEvent.click(screen.getByText(label));
    expect(screen.getByTestId(testId)).toBeTruthy();
  });

  it('заземление открывает QuickPracticeSheet с верным id', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Заземление 5-4-3-2-1'));
    expect(screen.getByTestId('quick-practice').textContent).toBe(
      'id=grounding',
    );
  });
});

describe('HelpSection — клик по задаче терапевта открывает нужный лист (openTask роутинг)', () => {
  it('задача типа schema_intro открывает SchemaIntroSheet с её id', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 3, assignedBy: 5, type: 'schema_intro', text: 'abandonment' }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    // Карточка схемы резолвит своё отображаемое название по task.text (id
    // схемы), а не рисует голый task.text — кликаем по резолвнутому тексту.
    fireEvent.click(screen.getByText(/Карточка схемы/));
    expect(screen.getByTestId('schema-intro').textContent).toBe(
      'schema=abandonment',
    );
  });

  it('задача типа flashcard открывает SchemaFlashcard', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 4,
        assignedBy: 5,
        type: 'flashcard',
        text: 'Пятишаговая карточка',
      }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Пятишаговая карточка'));
    expect(screen.getByTestId('flashcard')).toBeTruthy();
  });
});

describe('HelpSection — лист «Мои цели» и создание новой цели (read-after-write)', () => {
  it('после создания цели список задач перезапрашивается заново', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Мои цели'));
    fireEvent.click(await screen.findByText('Поставить цель'));
    mockApi.getTasks.mockClear();
    fireEvent.click(screen.getByText('task-create-created'));
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  });
});

describe('HelpSection — баннер следующей встречи из реальных данных терапии', () => {
  it('без активной терапии баннер не рисуется', async () => {
    await renderReady();
    expect(screen.queryByText(/Встреча/)).toBeNull();
  });

  it('с назначенной встречей клиента — баннер виден', async () => {
    const relation: TherapyRelationInfo = {
      role: 'client',
      status: 'active',
      partnerName: 'Иван Иванович',
      partnerId: 2,
      code: 'x',
      // Заведомо не сегодня (+10 дней) — иначе баннер покажет «Сегодня
      // встреча» вместо ожидаемого текста «Встреча: ...».
      nextSession: `${isoDateDaysFromNow(10)}T15:00`,
    };
    mockApi.getTherapyRelation.mockResolvedValue(relation);
    await renderReady();
    await screen.findByText(/Встреча/);
  });
});
