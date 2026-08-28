// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CaseFlowScreen, type CaseFlowSheetProps } from './CaseFlowScreen';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({
  api: { trackEvent: (...args: unknown[]) => trackEvent(...args) },
}));

beforeEach(() => {
  localStorage.clear();
  trackEvent.mockClear();
});
afterEach(() => cleanup());

const SCENE_TEXT = 'Мама позвонила и стала расспрашивать про работу';
const SCENE_PLACEHOLDER = /сообщение прочитано час назад/i;
const HARD_NOW = 'Тяжело прямо сейчас →';

function baseProps(
  overrides: Partial<CaseFlowSheetProps> = {},
): CaseFlowSheetProps {
  return {
    caseCount: 0,
    onSave: vi.fn().mockResolvedValue(undefined),
    onSaveCard: vi.fn().mockResolvedValue(undefined),
    onSteadyDay: vi.fn(),
    onOpenMap: vi.fn(),
    onClose: vi.fn(),
    onDoubt: vi.fn(),
    onHardNow: vi.fn(),
    ...overrides,
  };
}

function renderFlow(overrides: Partial<CaseFlowSheetProps> = {}) {
  return render(
    <MemoryRouter>
      <CaseFlowScreen {...baseProps(overrides)} />
    </MemoryRouter>,
  );
}

function typeScene(text: string) {
  fireEvent.change(screen.getByPlaceholderText(SCENE_PLACEHOLDER), {
    target: { value: text },
  });
}

/** hook → scene → mode (ModeFeelingBrowse: «Страшно, тревожно» →
 *  vulnerable_child) → body → криterion — минимальный путь для тестов,
 *  которым не важна мета body/impulse. */
function driveToCriterion() {
  fireEvent.click(screen.getByText('Разобрать свой случай'));
  typeScene(SCENE_TEXT);
  fireEvent.click(screen.getByText('Дальше'));
  fireEvent.click(screen.getByText(/Страшно, тревожно/));
  fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
  fireEvent.click(screen.getByText('Дальше')); // body -> impulse
  fireEvent.click(screen.getByText('Дальше')); // impulse -> criterion
}

function answerCriterion(biggerThanCause: boolean, talkedDown: boolean) {
  const yes = screen.getAllByText('Да');
  const no = screen.getAllByText('Нет');
  fireEvent.click(biggerThanCause ? yes[0] : no[0]);
  fireEvent.click(talkedDown ? yes[1] : no[1]);
}

describe('CaseFlowScreen — требует Router (useHistorySheet)', () => {
  it('падает без MemoryRouter — компонент действительно завязан на react-router', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CaseFlowScreen {...baseProps()} />)).toThrow();
    spy.mockRestore();
  });
});

describe('CaseFlowScreen — «Тяжело прямо сейчас» на каждом экране', () => {
  it('видна на hook, scene и criterion', () => {
    renderFlow();
    expect(screen.getByText(HARD_NOW)).toBeTruthy(); // hook
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    expect(screen.getByText(HARD_NOW)).toBeTruthy(); // scene
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.getByText(HARD_NOW)).toBeTruthy(); // criterion
  });
});

describe('CaseFlowScreen — кризисная детекция (правило №7)', () => {
  it('показывает CrisisCard при кризисной фразе в сцене', () => {
    renderFlow();
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene('хочу умереть');
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    renderFlow();
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});

describe('CaseFlowScreen — полный проход, маппинг onSave/onSaveCard, аналитика', () => {
  it('вердикт mode: полный проход сохраняет запись, карточку и шлёт события', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSaveCard = vi.fn().mockResolvedValue(undefined);
    const onOpenMap = vi.fn();
    renderFlow({ onSave, onSaveCard, onOpenMap, caseCount: 0 });

    fireEvent.click(screen.getByText('Разобрать свой случай'));
    expect(trackEvent).toHaveBeenCalledWith('case_started', {});

    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    expect(trackEvent).toHaveBeenCalledWith('case_scene', { source: 'own' });

    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(screen.getByText('Где это отозвалось в теле?')).toBeTruthy();

    fireEvent.click(screen.getByText('Сердце колотится'));
    fireEvent.click(screen.getByText('Своё…'));
    fireEvent.change(screen.getByPlaceholderText('Например: сжало в груди'), {
      target: { value: 'трясутся руки' },
    });
    fireEvent.click(screen.getByText('Дальше'));

    expect(screen.getByText('Что потянуло сделать?')).toBeTruthy();
    fireEvent.click(screen.getByText('Свернуть разговор'));
    fireEvent.click(screen.getByText('Уйти в телефон, в ленту'));
    fireEvent.click(screen.getByText('Дальше'));

    expect(screen.getByText('Это была часть или обычная досада?')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Да')[0]);
    fireEvent.click(screen.getAllByText('Нет')[1]);

    fireEvent.click(screen.getByText('Дальше')); // criterion -> recognition
    await waitFor(() => expect(screen.getByText('Вот что произошло')).toBeTruthy());

    expect(onSave).toHaveBeenCalledWith({
      modeId: 'vulnerable_child',
      situation: SCENE_TEXT,
      bodyFeelings: 'сердце колотится, трясутся руки',
      actions: 'свернуть разговор, уйти в телефон, в ленту',
    });
    expect(trackEvent).toHaveBeenCalledWith('case_criterion', { verdict: 'mode' });

    fireEvent.click(screen.getByText('Дальше')); // recognition -> name
    expect(trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: true,
    });
    expect(screen.getByText('Стена')).toBeTruthy();

    fireEvent.click(screen.getByText('Стена'));
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeTruthy());

    expect(trackEvent).toHaveBeenCalledWith('mode_renamed', { source: 'chip' });
    expect(onSaveCard).toHaveBeenCalledWith({
      modeId: 'vulnerable_child',
      alias: 'Стена',
      triggers: SCENE_TEXT,
      feelings: 'сердце колотится, трясутся руки',
      behavior: 'свернуть разговор, уйти в телефон, в ленту',
    });
    expect(trackEvent).toHaveBeenCalledWith('case_finished', { modeId: 'vulnerable_child' });

    fireEvent.click(screen.getByText('Открыть карту'));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });
});

describe('CaseFlowScreen — критерий Jacob и карточка режима', () => {
  it("вердикт 'ordinary' не вызывает onSaveCard, onSave — вызывает", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSaveCard = vi.fn().mockResolvedValue(undefined);
    renderFlow({ onSave, onSaveCard });

    driveToCriterion();
    answerCriterion(false, true); // ordinary
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() => expect(screen.getByText('Вот что произошло')).toBeTruthy());

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('case_criterion', { verdict: 'ordinary' });

    fireEvent.click(screen.getByText('Дальше')); // recognition -> name
    fireEvent.click(screen.getByText('Пропустить →'));
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeTruthy());

    expect(trackEvent).toHaveBeenCalledWith('mode_renamed', { source: 'skipped' });
    expect(onSaveCard).not.toHaveBeenCalled();
  });
});

describe('CaseFlowScreen — hook и выходы', () => {
  it('«Сегодня ровный день» вызывает onSteadyDay', () => {
    const onSteadyDay = vi.fn();
    renderFlow({ onSteadyDay });
    fireEvent.click(screen.getByText('Сегодня ровный день →'));
    expect(onSteadyDay).toHaveBeenCalledTimes(1);
  });

  it('«У меня было иначе» на экране узнавания вызывает onDoubt и шлёт agreed:false', async () => {
    const onDoubt = vi.fn();
    renderFlow({ onDoubt });
    driveToCriterion();
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() => expect(screen.getByText('Вот что произошло')).toBeTruthy());

    fireEvent.click(screen.getByText('У меня было иначе →'));
    expect(onDoubt).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: false,
    });
  });
});
