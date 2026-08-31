// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { CaseFlowSheet, type CaseFlowSheetProps } from './CaseFlowSheet';
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

const hardNowText = 'Тяжело прямо сейчас →';

function typeScene(text: string) {
  fireEvent.change(screen.getByPlaceholderText(SCENE_PLACEHOLDER), {
    target: { value: text },
  });
}

/** hook → scene → gate(«Страшно, тревожно») → candidate(vulnerable_child) →
 *  body → скидываем на criterion без выбора чипов — минимальный путь для
 *  тестов, которым не важна мета body/impulse (термин, «Дописать потом»). */
function driveToCriterion() {
  fireEvent.click(screen.getByText('Разобрать свой случай'));
  typeScene(SCENE_TEXT);
  fireEvent.click(screen.getByText('Дальше'));
  fireEvent.click(screen.getByText('Страшно, тревожно'));
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

describe('CaseFlowSheet — сцена: гейт «Дальше»', () => {
  it('заблокирована без своей детали, разблокируется после дописывания', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));

    typeScene('коротко');
    const next = screen.getByText('Дальше');
    expect(next.disabled).toBe(true);
    fireEvent.click(next);
    // экран не продвинулся — заголовок сцены всё ещё на месте
    expect(screen.getByText('Что случилось?')).toBeTruthy();

    typeScene(SCENE_TEXT);
    expect(screen.getByText('Дальше').disabled).toBe(false);
  });
});

describe('CaseFlowSheet — полный проход, маппинг onSave/onSaveCard, аналитика', () => {
  it('вердикт mode: полный проход сохраняет запись, карточку и шлёт события', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSaveCard = vi.fn().mockResolvedValue(undefined);
    const onOpenMap = vi.fn();
    render(
      <CaseFlowSheet
        {...baseProps({ onSave, onSaveCard, onOpenMap, caseCount: 0 })}
      />,
    );

    expect(screen.getByText(hardNowText)).toBeTruthy(); // hook

    fireEvent.click(screen.getByText('Разобрать свой случай'));
    expect(trackEvent).toHaveBeenCalledWith('case_started', {});
    expect(screen.getByText(hardNowText)).toBeTruthy(); // scene

    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    expect(trackEvent).toHaveBeenCalledWith('case_scene', { source: 'own' });
    expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy(); // gate
    expect(screen.getByText(hardNowText)).toBeTruthy();

    fireEvent.click(screen.getByText('Страшно, тревожно'));
    expect(screen.getByText('Про что этот страх?')).toBeTruthy(); // candidate
    expect(screen.getByText(hardNowText)).toBeTruthy();

    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(screen.getByText('Где это отозвалось в теле?')).toBeTruthy(); // body
    expect(screen.getByText(hardNowText)).toBeTruthy();

    fireEvent.click(screen.getByText('Сердце колотится'));
    expect(screen.getByText(/Это уже примета/)).toBeTruthy(); // отдача после первого чипа
    fireEvent.click(screen.getByText('Своё…'));
    fireEvent.change(screen.getByPlaceholderText('Например: сжало в груди'), {
      target: { value: 'трясутся руки' },
    });
    fireEvent.click(screen.getByText('Дальше'));

    expect(screen.getByText('Что потянуло сделать?')).toBeTruthy(); // impulse
    expect(screen.getByText(hardNowText)).toBeTruthy();
    fireEvent.click(screen.getByText('Свернуть разговор'));
    fireEvent.click(screen.getByText('Уйти в телефон, в ленту'));
    fireEvent.click(screen.getByText('Дальше'));

    expect(screen.getByText('Это была часть или обычная досада?')).toBeTruthy(); // criterion
    expect(screen.getByText(hardNowText)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Да')[0]); // biggerThanCause = true
    fireEvent.click(screen.getAllByText('Нет')[1]); // talkedDown = false → mode
    expect(
      screen.getByText('Крупнее повода и не уговорить — значит, часть.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByText('Дальше')); // criterion -> recognition (async save)
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );

    expect(onSave).toHaveBeenCalledWith({
      modeId: 'vulnerable_child',
      situation: SCENE_TEXT,
      bodyFeelings: 'сердце колотится, трясутся руки',
      actions: 'свернуть разговор, уйти в телефон, в ленту',
    });
    expect(trackEvent).toHaveBeenCalledWith('case_criterion', {
      verdict: 'mode',
    });
    // термин показывается при первом разборе
    expect(screen.getByText(/Полчаса назад было нормально/)).toBeTruthy();
    // вторая дверь: impulse_close -> avoidant_protector != vulnerable_child
    expect(
      screen.getByText(
        'Похоже, тут работали двое. Начнём с того, кто вышел вперёд.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(hardNowText)).toBeTruthy();

    fireEvent.click(screen.getByText('Дальше')); // recognition -> name
    expect(trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: true,
    });
    expect(screen.getByText('Как назовёшь эту часть?')).toBeTruthy();
    expect(screen.getByText(hardNowText)).toBeTruthy();
    // заготовки — из выбранных чипов порыва
    expect(screen.getByText('Стена')).toBeTruthy();
    expect(screen.getByText('Побег')).toBeTruthy();

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
    expect(trackEvent).toHaveBeenCalledWith('case_finished', {
      modeId: 'vulnerable_child',
    });

    // done: имя, приметы, отдача, «Тяжело прямо сейчас» всё ещё на месте
    expect(screen.getByText('Стена')).toBeTruthy();
    expect(
      screen.getByText(
        'Это была первая запись в дневнике — заняла три минуты. Вторая покажет, что у тебя повторяется.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(hardNowText)).toBeTruthy();

    fireEvent.click(screen.getByText('Открыть карту'));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });
});

describe('CaseFlowSheet — критерий Jacob и карточка режима', () => {
  it("вердикт 'ordinary' не вызывает onSaveCard, onSave — вызывает", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSaveCard = vi.fn().mockResolvedValue(undefined);
    render(<CaseFlowSheet {...baseProps({ onSave, onSaveCard })} />);

    driveToCriterion();
    fireEvent.click(screen.getAllByText('Нет')[0]); // biggerThanCause = false
    fireEvent.click(screen.getAllByText('Да')[1]); // talkedDown = true -> ordinary
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('case_criterion', {
      verdict: 'ordinary',
    });

    fireEvent.click(screen.getByText('Дальше')); // recognition -> name
    fireEvent.click(screen.getByText('Пропустить →'));
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeTruthy());

    expect(trackEvent).toHaveBeenCalledWith('mode_renamed', {
      source: 'skipped',
    });
    expect(onSaveCard).not.toHaveBeenCalled();
  });
});

describe('CaseFlowSheet — термин «режим»', () => {
  it('показывается при caseCount === 0', async () => {
    render(<CaseFlowSheet {...baseProps({ caseCount: 0 })} />);
    driveToCriterion();
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );
    expect(screen.getByText(/Полчаса назад было нормально/)).toBeTruthy();
  });

  it('не показывается при caseCount > 0', async () => {
    render(<CaseFlowSheet {...baseProps({ caseCount: 3 })} />);
    driveToCriterion();
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );
    expect(screen.queryByText(/Полчаса назад было нормально/)).toBeNull();
  });
});

describe('CaseFlowSheet — «Дописать потом»', () => {
  it('сохраняет черновик и закрывает без подтверждения', () => {
    const onClose = vi.fn();
    render(<CaseFlowSheet {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene('коротко, но не пусто');

    fireEvent.click(screen.getByText('Дописать потом'));

    expect(onClose).toHaveBeenCalledTimes(1);
    const raw = localStorage.getItem('diary_draft_case');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved.step).toBe('scene');
    expect(saved.scene).toBe('коротко, но не пусто');
  });
});

describe('CaseFlowSheet — кризисная детекция (правило №7)', () => {
  it('показывает CrisisCard при кризисной фразе в сцене', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene('хочу умереть');
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});

describe('CaseFlowSheet — hook и выходы', () => {
  it('«Сегодня ровный день» вызывает onSteadyDay и закрывает поток', () => {
    const onSteadyDay = vi.fn();
    const onClose = vi.fn();
    render(<CaseFlowSheet {...baseProps({ onSteadyDay, onClose })} />);
    fireEvent.click(screen.getByText('Сегодня ровный день →'));
    expect(onSteadyDay).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('«Тяжело прямо сейчас» вызывает onHardNow на hook-экране', () => {
    const onHardNow = vi.fn();
    render(<CaseFlowSheet {...baseProps({ onHardNow })} />);
    fireEvent.click(screen.getByText(hardNowText));
    expect(onHardNow).toHaveBeenCalledTimes(1);
  });

  it('«У меня было иначе» на экране узнавания вызывает onDoubt и шлёт agreed:false', async () => {
    const onDoubt = vi.fn();
    render(<CaseFlowSheet {...baseProps({ onDoubt })} />);
    driveToCriterion();
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );

    fireEvent.click(screen.getByText('У меня было иначе →'));
    expect(onDoubt).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: false,
    });
  });
});

// Несущее правило потока: рамка — старт для тех, у кого свой текст с чистого
// листа не идёт, но карточка режима не может держаться на наших словах.
// «Дальше» обязана оставаться заблокированной, пока к рамке не добавлена
// собственная деталь (hasOwnDetail, shared/src/case/caseFrames.ts) — иначе
// на карту уезжает шаблонная фраза, выданная за прожитый случай.
describe('CaseFlowSheet — сцена: рамка не пускает дальше без своей детали', () => {
  it('рамка без правки блокирует «Дальше», дописанная деталь снимает блок', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));

    fireEvent.click(screen.getByText('Не идёт — взять рамку →'));
    fireEvent.click(
      screen.getByText('Сообщение прочитано час назад. Ответа нет.'),
    );

    expect(screen.getByText(/Рамка\. Допиши/)).toBeTruthy();
    expect(screen.getByText('Дальше').disabled).toBe(true);

    typeScene(
      'Сообщение прочитано час назад. Ответа нет. Мама позвонила следом',
    );
    expect(screen.getByText('Дальше').disabled).toBe(false);
  });

  it('«Скрыть рамки» сворачивает список рамок обратно', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    fireEvent.click(screen.getByText('Не идёт — взять рамку →'));
    expect(
      screen.getByText('Сообщение прочитано час назад. Ответа нет.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByText('Скрыть рамки ▲'));
    expect(
      screen.queryByText('Сообщение прочитано час назад. Ответа нет.'),
    ).toBeNull();
  });
});

describe('CaseFlowSheet — «Своё…» на экране порыва', () => {
  it('открывает поле, текст уходит в actions на сохранении', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CaseFlowSheet {...baseProps({ onSave })} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    fireEvent.click(screen.getByText('Дальше')); // body -> impulse

    fireEvent.click(screen.getByText('Своё…'));
    fireEvent.change(
      screen.getByPlaceholderText('Например: хотелось всё бросить'),
      { target: { value: 'хотелось хлопнуть дверью' } },
    );
    fireEvent.click(screen.getByText('Дальше')); // impulse -> criterion

    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ actions: 'хотелось хлопнуть дверью' }),
    );
  });
});

describe('CaseFlowSheet — своё имя части', () => {
  it('печатает своё слово, «Назвать» разблокируется только с текстом, source own', async () => {
    const onSaveCard = vi.fn().mockResolvedValue(undefined);
    render(<CaseFlowSheet {...baseProps({ onSaveCard })} />);
    driveToCriterion();
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('Дальше')); // recognition -> name

    const nameButton = () => screen.getByText('Назвать');
    expect(nameButton().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Своё слово'), {
      target: { value: 'Ёжик' },
    });
    expect(nameButton().disabled).toBe(false);
    fireEvent.click(nameButton());

    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeTruthy());
    expect(onSaveCard).toHaveBeenCalledWith(
      expect.objectContaining({ alias: 'Ёжик' }),
    );
  });
});

// Навигация назад — отдельный от useCaseFlowState.handleLater путь: «Назад»
// возвращает на предыдущий шаг с сохранёнными полями (правку не роняет),
// «Дописать потом»/«Закрыть» выходят из потока целиком. Оба пути должны жить
// раздельно — до этого теста goBack() ни разу не вызывался ни на одном шаге.
describe('CaseFlowSheet — «Назад» проводит по шагам в обратном порядке', () => {
  it('со сцены на hook, дальше по всем шагам вплоть до критерия — назад и снова вперёд', () => {
    render(<CaseFlowSheet {...baseProps()} />);

    fireEvent.click(screen.getByText('Разобрать свой случай'));
    expect(screen.getByText('Что случилось?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Разобрать свой случай')).toBeTruthy(); // снова hook

    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Что случилось?')).toBeTruthy(); // снова сцена
    expect(screen.getByText('Дальше').disabled).toBe(false); // текст не потерян

    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    expect(screen.getByText('Про что этот страх?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy(); // снова ворота

    fireEvent.click(screen.getByText('Страшно, тревожно'));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(screen.getByText('Где это отозвалось в теле?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Про что этот страх?')).toBeTruthy(); // снова кандидаты

    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    fireEvent.click(screen.getByText('Дальше')); // body -> impulse
    expect(screen.getByText('Что потянуло сделать?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Где это отозвалось в теле?')).toBeTruthy(); // снова тело

    fireEvent.click(screen.getByText('Дальше')); // тело -> порыв
    fireEvent.click(screen.getByText('Дальше')); // порыв -> критерий
    expect(screen.getByText('Это была часть или обычная досада?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Что потянуло сделать?')).toBeTruthy(); // снова порыв
  });
});

describe('CaseFlowSheet — выбор режима напрямую из списка на экране чувств', () => {
  it('минует экран кандидатов и ведёт сразу в тело', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));

    fireEvent.click(screen.getByText(/Все режимы по группам/));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));

    expect(screen.getByText('Где это отозвалось в теле?')).toBeTruthy();
  });
});

describe('CaseFlowSheet — «не могу выбрать» на экране кандидатов', () => {
  it('переключает семью на «подскажет тело», второй тап возвращает к чувствам', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    expect(screen.getByText('Про что этот страх?')).toBeTruthy();

    fireEvent.click(screen.getByText('Не могу выбрать — пусть подскажет тело'));
    expect(
      screen.getByText('Не могу выбрать — вернуться к чувствам'),
    ).toBeTruthy();

    fireEvent.click(screen.getByText('Не могу выбрать — вернуться к чувствам'));
    expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy();
  });
});
