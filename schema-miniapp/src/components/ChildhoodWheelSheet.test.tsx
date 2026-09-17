// @vitest-environment jsdom
// ChildhoodWheelSheet — контейнер колеса детства (0% покрытия): фаза intro/
// fill/result по CHILDHOOD_DONE_KEY, сохранение локально-первым (UI не
// зависает от сети) с фоновой синхронизацией api.saveChildhoodRatings, и
// подгрузка уже сохранённых оценок с сервера когда колесо уже пройдено.
// Intro/Fill/ResultPhase уже покрыты своими тестами — мокаем их здесь.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { ChildhoodWheelSheet, CHILDHOOD_DONE_KEY } from './ChildhoodWheelSheet';
import { api } from '../api';

vi.mock('../api', () => ({
  api: { getChildhoodRatings: vi.fn(), saveChildhoodRatings: vi.fn() },
}));
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./childhoodWheelSheet/IntroPhase', () => ({
  IntroPhase: ({
    onStart,
    onSkip,
  }: {
    onStart: () => void;
    onSkip: () => void;
  }) => (
    <div data-testid="intro-phase">
      <button onClick={onStart}>start</button>
      <button onClick={onSkip}>skip</button>
    </div>
  ),
}));
vi.mock('./childhoodWheelSheet/FillPhase', () => ({
  FillPhase: ({ onSave, saving }: { onSave: () => void; saving: boolean }) => (
    <div data-testid="fill-phase">
      <span>saving-{String(saving)}</span>
      <button onClick={onSave}>save</button>
    </div>
  ),
}));
vi.mock('./childhoodWheelSheet/ResultPhase', () => ({
  ResultPhase: ({
    onEdit,
    onDone,
    ratings,
  }: {
    onEdit: () => void;
    onDone: () => void;
    ratings: Record<string, number>;
  }) => (
    <div data-testid="result-phase">
      <span>attachment-{ratings.attachment}</span>
      <button onClick={onEdit}>edit</button>
      <button onClick={onDone}>done</button>
    </div>
  ),
}));
vi.mock('./childhoodWheelSheet/SchemaDescSheet', () => ({
  SchemaDescSheet: () => <div data-testid="schema-desc-sheet" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('ChildhoodWheelSheet — стартовая фаза', () => {
  it('колесо ещё не пройдено — открывается на IntroPhase', () => {
    render(<ChildhoodWheelSheet onClose={() => {}} onOpenSchemas={() => {}} />);
    expect(screen.getByTestId('intro-phase')).toBeTruthy();
    expect(mockApi.getChildhoodRatings).not.toHaveBeenCalled();
  });

  it('колесо уже пройдено — сначала скелетон, потом ResultPhase с подгруженными оценками', async () => {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    mockApi.getChildhoodRatings.mockResolvedValue({ attachment: 3 });
    render(<ChildhoodWheelSheet onClose={() => {}} onOpenSchemas={() => {}} />);
    // До ответа сервера — скелетон, не ResultPhase с нейтральным дефолтом
    // (иначе «5» на секунду выглядел бы как реальный сохранённый ответ).
    expect(screen.queryByTestId('result-phase')).toBeNull();
    await waitFor(() => expect(screen.getByText('attachment-3')).toBeTruthy());
  });

  it('сбой api.getChildhoodRatings — показывает ResultPhase с дефолтом, но помечает: данные могли не загрузиться (regression: check-silent-catch)', async () => {
    // Раньше провал молчал полностью: пользователь видел дефолтные «5» как
    // будто это его реальный сохранённый ответ (запрещённый CLAUDE.md
    // паттерн «заглушка вместо реальных данных»).
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    mockApi.getChildhoodRatings.mockRejectedValue(new Error('network'));
    render(<ChildhoodWheelSheet onClose={() => {}} onOpenSchemas={() => {}} />);
    await waitFor(() => expect(screen.getByText('attachment-5')).toBeTruthy());
    expect(
      screen.getByText(/Не удалось загрузить сохранённый результат/),
    ).toBeTruthy();
  });
});

describe('ChildhoodWheelSheet — переходы intro → fill → result', () => {
  it('«start» переключает на FillPhase', () => {
    render(<ChildhoodWheelSheet onClose={() => {}} onOpenSchemas={() => {}} />);
    fireEvent.click(screen.getByText('start'));
    expect(screen.getByTestId('fill-phase')).toBeTruthy();
  });

  it('«skip» помечает колесо пройденным и закрывает лист', () => {
    const onClose = vi.fn();
    render(<ChildhoodWheelSheet onClose={onClose} onOpenSchemas={() => {}} />);
    fireEvent.click(screen.getByText('skip'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CHILDHOOD_DONE_KEY)).toBe('1');
  });

  it('сохранение из FillPhase: сразу переключает на result, помечает localStorage, зовёт onSaved и фоново синхронизирует api', async () => {
    mockApi.saveChildhoodRatings.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(
      <ChildhoodWheelSheet
        onClose={() => {}}
        onOpenSchemas={() => {}}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByText('start'));
    fireEvent.click(screen.getByText('save'));
    expect(screen.getByTestId('result-phase')).toBeTruthy();
    expect(localStorage.getItem(CHILDHOOD_DONE_KEY)).toBe('1');
    expect(onSaved).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockApi.saveChildhoodRatings).toHaveBeenCalledTimes(1),
    );
  });

  it('сбой фоновой синхронизации api.saveChildhoodRatings не откатывает UI назад в fill', async () => {
    mockApi.saveChildhoodRatings.mockRejectedValue(new Error('network'));
    render(<ChildhoodWheelSheet onClose={() => {}} onOpenSchemas={() => {}} />);
    fireEvent.click(screen.getByText('start'));
    fireEvent.click(screen.getByText('save'));
    await waitFor(() =>
      expect(mockApi.saveChildhoodRatings).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByTestId('result-phase')).toBeTruthy();
  });

  it('«edit» из ResultPhase возвращает на FillPhase', async () => {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    mockApi.getChildhoodRatings.mockResolvedValue({});
    render(<ChildhoodWheelSheet onClose={() => {}} onOpenSchemas={() => {}} />);
    await screen.findByText('edit');
    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByTestId('fill-phase')).toBeTruthy();
  });

  it('«done» из ResultPhase помечает пройденным и закрывает', async () => {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    mockApi.getChildhoodRatings.mockResolvedValue({});
    const onClose = vi.fn();
    render(<ChildhoodWheelSheet onClose={onClose} onOpenSchemas={() => {}} />);
    await screen.findByText('done');
    fireEvent.click(screen.getByText('done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
