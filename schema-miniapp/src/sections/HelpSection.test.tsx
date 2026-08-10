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
  BeliefCheck: ({
    onClose,
    onComplete,
  }: {
    onClose: () => void;
    onComplete?: () => void;
  }) => (
    <div data-testid="belief-check">
      <button onClick={onClose}>belief-close</button>
      <button onClick={onComplete}>belief-complete</button>
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
vi.mock('../components/PhraseCheck', () => ({
  PhraseCheck: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="phrase-check">
      <button onClick={onClose}>phrase-check-close</button>
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
  SchemaIntroSheet: ({
    schemaId,
    onClose,
    onComplete,
  }: {
    schemaId: string;
    onClose: () => void;
    onComplete: () => void;
  }) => (
    <div data-testid="schema-intro">
      schema={schemaId}
      <button onClick={onClose}>schema-intro-close</button>
      <button onClick={onComplete}>schema-intro-complete</button>
    </div>
  ),
}));
vi.mock('../components/ModeIntroSheet', () => ({
  ModeIntroSheet: ({
    modeId,
    onClose,
    onComplete,
  }: {
    modeId: string;
    onClose: () => void;
    onComplete: () => void;
  }) => (
    <div data-testid="mode-intro">
      mode={modeId}
      <button onClick={onClose}>mode-intro-close</button>
      <button onClick={onComplete}>mode-intro-complete</button>
    </div>
  ),
}));
vi.mock('../components/SelfHelpDisclaimer', () => ({
  SelfHelpSheet: ({
    onClose,
    onOpenCrisis,
  }: {
    onClose: () => void;
    onOpenCrisis: () => void;
  }) => (
    <div data-testid="self-help">
      <button onClick={onClose}>self-help-close</button>
      <button onClick={onOpenCrisis}>self-help-open-crisis</button>
    </div>
  ),
}));
vi.mock('../components/QuickPracticeSheet', () => ({
  QuickPracticeSheet: ({
    id,
    onClose,
  }: {
    id: string;
    onClose: () => void;
  }) => (
    <div data-testid="quick-practice">
      id={id}
      <button onClick={onClose}>quick-practice-close</button>
    </div>
  ),
}));
vi.mock('../components/TaskCreateSheet', async (importOriginal) => {
  // getTaskDisplayText нужен реальным TaskRow-строкам (taskEmoji.ts его
  // импортирует отсюда же) — подменяем только сам компонент листа.
  const actual =
    await importOriginal<typeof import('../components/TaskCreateSheet')>();
  return {
    ...actual,
    TaskCreateSheet: ({
      onCreated,
      onClose,
    }: {
      onCreated: () => void;
      onClose: () => void;
    }) => (
      <div data-testid="task-create">
        <button onClick={onCreated}>task-create-created</button>
        <button onClick={onClose}>task-create-close</button>
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
    expect(screen.getByTestId('quick-practice').textContent).toContain(
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
    expect(screen.getByTestId('schema-intro').textContent).toContain(
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

describe('HelpSection — initialTasks (прогрев из App.tsx) применяется как стартовый список', () => {
  it('переданный initialTasks сразу отражается без ожидания api.getTasks', async () => {
    mockApi.getTasks.mockResolvedValue([]);
    render(
      <HelpSection
        {...baseProps()}
        initialTasks={[
          task({
            id: 7,
            assignedBy: 5,
            type: 'belief_check',
            doneToday: false,
          }),
        ]}
      />,
    );
    await screen.findByText('От терапевта');
  });
});

describe('HelpSection — падение статуса терапии не рушит экран', () => {
  it('getTherapyRelation отклонился → баннер встречи просто не рисуется', async () => {
    mockApi.getTherapyRelation.mockRejectedValue(new Error('network down'));
    await renderReady();
    expect(screen.queryByText(/Встреча/)).toBeNull();
  });
});

describe('HelpSection — открытие задачи терапевта по типу (openTask роутинг, продолжение)', () => {
  it('tracker_streak вызывает onOpenTracker', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 10,
        assignedBy: 5,
        type: 'tracker_streak',
        text: 'Отмечать потребности 7 дней подряд',
        doneToday: false,
      }),
    ]);
    const onOpenTracker = vi.fn();
    await renderReady({ onOpenTracker });
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Отмечать потребности 7 дней подряд'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('belief_check открывает лист BeliefCheck', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 11,
        assignedBy: 5,
        type: 'belief_check',
        text: 'Проверить убеждение',
        doneToday: false,
      }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Проверить убеждение'));
    expect(screen.getByTestId('belief-check')).toBeTruthy();
  });

  it('letter_to_self открывает лист LetterToSelf', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 12,
        assignedBy: 5,
        type: 'letter_to_self',
        text: 'Написать письмо Уязвимому Ребёнку',
        doneToday: false,
      }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Написать письмо Уязвимому Ребёнку'));
    expect(screen.getByTestId('letter-to-self')).toBeTruthy();
  });

  it('safe_place открывает лист SafePlace', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 13,
        assignedBy: 5,
        type: 'safe_place',
        text: 'Описать Безопасное место',
        doneToday: false,
      }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Описать Безопасное место'));
    expect(screen.getByTestId('safe-place')).toBeTruthy();
  });

  it('childhood_wheel вызывает onOpenChildhoodWheel', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 14,
        assignedBy: 5,
        type: 'childhood_wheel',
        text: 'Колесо детства',
        doneToday: false,
      }),
    ]);
    const onOpenChildhoodWheel = vi.fn();
    await renderReady({ onOpenChildhoodWheel });
    await screen.findByText('От терапевта');
    // «Колесо детства» есть и в баннере «От терапевта», и отдельным
    // инструментом в списке ниже — кликаем именно по задаче терапевта
    // (первая в порядке документа).
    fireEvent.click(screen.getAllByText('Колесо детства')[0]);
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  it('mode_intro открывает ModeIntroSheet с id режима из task.text', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 15,
        assignedBy: 5,
        type: 'mode_intro',
        text: 'vulnerable_child',
      }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка режима/));
    expect(screen.getByTestId('mode-intro').textContent).toContain(
      'mode=vulnerable_child',
    );
  });
});

describe('HelpSection — легаси-формат задачи: тип не распознан, но текст — реальный id схемы/режима', () => {
  it('неизвестный тип с текстом-id схемы всё равно открывает карточку схемы', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 30, assignedBy: 5, type: 'legacy', text: 'abandonment' }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка схемы/));
    expect(screen.getByTestId('schema-intro').textContent).toContain(
      'schema=abandonment',
    );
  });

  it('неизвестный тип с текстом-id режима открывает карточку режима', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 31, assignedBy: 5, type: 'legacy', text: 'vulnerable_child' }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка режима/));
    expect(screen.getByTestId('mode-intro').textContent).toContain(
      'mode=vulnerable_child',
    );
  });
});

describe('HelpSection — завершение задания (handleTaskComplete): перезапрашивает задачи и сообщает наверх', () => {
  it('завершение назначенной задачи вызывает api.completeTask, перезагружает список и зовёт onTasksChanged', async () => {
    mockApi.getTasks.mockResolvedValueOnce([
      task({
        id: 20,
        assignedBy: 5,
        type: 'belief_check',
        text: 'Проверить убеждение',
        doneToday: false,
      }),
    ]);
    mockApi.completeTask.mockResolvedValue(undefined);
    const onTasksChanged = vi.fn();
    await renderReady({ onTasksChanged });
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Проверить убеждение'));
    expect(screen.getByTestId('belief-check')).toBeTruthy();

    mockApi.getTasks.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByText('belief-complete'));

    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(20, true),
    );
    await waitFor(() => expect(onTasksChanged).toHaveBeenCalledTimes(1));
  });

  // Регрессия: раньше вся цепочка completeTask→рефетч глушилась одним
  // `.catch(() => {})` без единого следа в логах. Сеть упала — задача от
  // терапевта обязана остаться в списке (а не пропасть и не «зависнуть»
  // отмеченной), а сбой обязан попасть в console.error, а не потеряться.
  it('падение api.completeTask не роняет экран и не зовёт onTasksChanged — задача остаётся в списке', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.getTasks.mockResolvedValueOnce([
      task({
        id: 22,
        assignedBy: 5,
        type: 'belief_check',
        text: 'Проверить убеждение',
        doneToday: false,
      }),
    ]);
    mockApi.completeTask.mockRejectedValue(new Error('network'));
    const onTasksChanged = vi.fn();
    await renderReady({ onTasksChanged });
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Проверить убеждение'));
    fireEvent.click(screen.getByText('belief-complete'));

    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(22, true),
    );
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(onTasksChanged).not.toHaveBeenCalled();
    expect(await screen.findByText('Проверить убеждение')).toBeTruthy();
    errorSpy.mockRestore();
  });
});

describe('HelpSection — diary_streak-задача терапевта открывает дневники', () => {
  it('клик по назначенной diary_streak вызывает onOpenDiaries', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({
        id: 21,
        assignedBy: 5,
        type: 'diary_streak',
        text: 'Заполнять дневник 7 дней подряд',
        doneToday: false,
      }),
    ]);
    const onOpenDiaries = vi.fn();
    await renderReady({ onOpenDiaries });
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText('Заполнять дневник 7 дней подряд'));
    expect(onOpenDiaries).toHaveBeenCalledTimes(1);
  });
});

describe('HelpSection — завершение задачи без активного task-id не бьёт по API (открыто не из баннера терапевта)', () => {
  it('BeliefCheck, открытый из ToolsList (не из задачи), onComplete не вызывает api.completeTask', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Проверка убеждений'));
    fireEvent.click(screen.getByText('belief-complete'));
    expect(mockApi.completeTask).not.toHaveBeenCalled();
  });
});

describe('HelpSection — все дочерние листы реально закрываются (не залипают открытыми)', () => {
  it('«Схема включилась» → лист флешкарты, закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Схема включилась'));
    expect(screen.getByTestId('flashcard')).toBeTruthy();
    fireEvent.click(screen.getByText('flashcard-close'));
    expect(screen.queryByTestId('flashcard')).toBeNull();
  });

  it('«Проверка убеждений» закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Проверка убеждений'));
    fireEvent.click(screen.getByText('belief-close'));
    expect(screen.queryByTestId('belief-check')).toBeNull();
  });

  it('«Письмо себе» закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Письмо себе'));
    fireEvent.click(screen.getByText('letter-close'));
    expect(screen.queryByTestId('letter-to-self')).toBeNull();
  });

  it('«Безопасное место» закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Безопасное место'));
    fireEvent.click(screen.getByText('safe-place-close'));
    expect(screen.queryByTestId('safe-place')).toBeNull();
  });

  it('«Тёплые слова» закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Тёплые слова'));
    fireEvent.click(screen.getByText('warm-words-close'));
    expect(screen.queryByTestId('warm-words')).toBeNull();
  });

  it('«О границах самопомощи» закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('О границах самопомощи'));
    fireEvent.click(await screen.findByText('self-help-close'));
    expect(screen.queryByTestId('self-help')).toBeNull();
  });

  it('заземление закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Заземление 5-4-3-2-1'));
    fireEvent.click(screen.getByText('quick-practice-close'));
    expect(screen.queryByTestId('quick-practice')).toBeNull();
  });

  it('техника «Стоп» открывается и закрывается', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Техника «Стоп»'));
    expect(screen.getByTestId('quick-practice').textContent).toContain(
      'id=stop',
    );
    fireEvent.click(screen.getByText('quick-practice-close'));
    expect(screen.queryByTestId('quick-practice')).toBeNull();
  });

  it('карточка кризиса «Мне очень плохо» закрывается по Escape', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Мне очень плохо'));
    await screen.findByText('Помощь рядом');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Помощь рядом')).toBeNull();
  });

  it('карточка схемы (SchemaIntroSheet) закрывается и завершается', async () => {
    mockApi.getTasks.mockResolvedValueOnce([
      task({
        id: 22,
        assignedBy: 5,
        type: 'schema_intro',
        text: 'abandonment',
      }),
    ]);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка схемы/));
    expect(screen.getByTestId('schema-intro')).toBeTruthy();
    fireEvent.click(screen.getByText('schema-intro-close'));
    expect(screen.queryByTestId('schema-intro')).toBeNull();
  });

  it('карточка схемы завершается через onComplete (списывает activeTaskId)', async () => {
    mockApi.getTasks.mockResolvedValueOnce([
      task({
        id: 23,
        assignedBy: 5,
        type: 'schema_intro',
        text: 'abandonment',
      }),
    ]);
    mockApi.completeTask.mockResolvedValue(undefined);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка схемы/));
    mockApi.getTasks.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByText('schema-intro-complete'));
    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(23, true),
    );
    expect(screen.queryByTestId('schema-intro')).toBeNull();
  });

  it('карточка режима (ModeIntroSheet) закрывается и завершается', async () => {
    mockApi.getTasks.mockResolvedValueOnce([
      task({
        id: 24,
        assignedBy: 5,
        type: 'mode_intro',
        text: 'vulnerable_child',
      }),
    ]);
    mockApi.completeTask.mockResolvedValue(undefined);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка режима/));
    fireEvent.click(screen.getByText('mode-intro-close'));
    expect(screen.queryByTestId('mode-intro')).toBeNull();
  });

  it('карточка режима завершается через onComplete (списывает activeTaskId)', async () => {
    mockApi.getTasks.mockResolvedValueOnce([
      task({
        id: 25,
        assignedBy: 5,
        type: 'mode_intro',
        text: 'vulnerable_child',
      }),
    ]);
    mockApi.completeTask.mockResolvedValue(undefined);
    await renderReady();
    await screen.findByText('От терапевта');
    fireEvent.click(screen.getByText(/Карточка режима/));
    mockApi.getTasks.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByText('mode-intro-complete'));
    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(25, true),
    );
    expect(screen.queryByTestId('mode-intro')).toBeNull();
  });
});

describe('HelpSection — лист «Мои цели»: закрытие и завершение своей цели изнутри списка', () => {
  it('закрытие «Мои цели» (Escape) снова прячет лист', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Мои цели'));
    await screen.findByText('Поставить цель');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Поставить цель')).toBeNull();
  });

  it('завершение своей (custom) цели прямо из списка перезагружает задачи (onReload)', async () => {
    mockApi.getTasks.mockResolvedValue([
      task({ id: 40, type: 'custom', text: 'Пить воду', done: null }),
    ]);
    mockApi.completeTask.mockResolvedValue(undefined);
    await renderReady();
    fireEvent.click(screen.getByText('Мои цели'));
    await screen.findByText('Пить воду');
    mockApi.getTasks.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByText('Готово'));
    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(40, true),
    );
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalledTimes(2));
  });
});

describe('HelpSection — «Проверка фраз» открывает и закрывает лист PhraseCheck', () => {
  it('клик открывает PhraseCheck, закрытие возвращает на экран', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Критик или забота?'));
    expect(screen.getByTestId('phrase-check')).toBeTruthy();
    fireEvent.click(screen.getByText('phrase-check-close'));
    expect(screen.queryByTestId('phrase-check')).toBeNull();
  });
});

describe('HelpSection — создание цели можно отменить без создания', () => {
  it('«Отмена» в TaskCreateSheet закрывает лист, не перезапрашивая задачи', async () => {
    await renderReady();
    fireEvent.click(screen.getByText('Мои цели'));
    fireEvent.click(await screen.findByText('Поставить цель'));
    mockApi.getTasks.mockClear();
    fireEvent.click(screen.getByText('task-create-close'));
    expect(screen.queryByTestId('task-create')).toBeNull();
    expect(mockApi.getTasks).not.toHaveBeenCalled();
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

describe('HelpSection — единый вход «Настроить экран» (фидбек владельца: пилюля у «Инструментов» терялась глубоко по скроллу)', () => {
  it('шестерёнка в шапке открывает тот же лист настройки инструментов, что и пилюля у «Инструментов»', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить инструменты'));
    expect(
      await screen.findByText('Какие инструменты показывать'),
    ).toBeTruthy();
  });

  it('контекстная пилюля «Настроить» у «Инструментов» по-прежнему открывает лист', async () => {
    await renderReady();
    fireEvent.click(screen.getByLabelText('Настроить список инструментов'));
    expect(
      await screen.findByText('Какие инструменты показывать'),
    ).toBeTruthy();
  });
});
