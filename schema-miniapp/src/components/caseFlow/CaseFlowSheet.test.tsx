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
import {
  buildFrameHint,
  buildFramesToggle,
} from '../../../../shared/src/case/caseFrames';
import {
  buildCriterionIntro,
  buildVerdictReply,
} from '../../../../shared/src/case/caseCriterion';
import type { Tr } from '../../../../shared/src/case/caseTypes';

// Тексты экранов берём из тех же билдеров, что и рантайм (не хардкодим
// копии: формулировки правятся по фидбеку владельца, и тест не должен
// краснеть от каждой правки слова). Форма по умолчанию — «ты».
const trTy: Tr = (ty) => ty;
const CRITERION_TITLE = buildCriterionIntro(trTy).title;

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
    // поле «своё» видно сразу — чипа «Своё…» на экране больше нет
    fireEvent.change(screen.getByPlaceholderText('Например: сжало в груди'), {
      target: { value: 'трясутся руки' },
    });
    fireEvent.click(screen.getByText('Дальше'));

    expect(screen.getByText('Что потянуло сделать?')).toBeTruthy(); // impulse
    expect(screen.getByText(hardNowText)).toBeTruthy();
    fireEvent.click(screen.getByText('Свернуть разговор'));
    fireEvent.click(screen.getByText('Уйти в телефон, в ленту'));
    fireEvent.click(screen.getByText('Дальше'));

    expect(screen.getByText(CRITERION_TITLE)).toBeTruthy(); // criterion
    expect(screen.getByText(hardNowText)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Да')[0]); // biggerThanCause = true
    fireEvent.click(screen.getAllByText('Нет')[1]); // talkedDown = false → mode
    expect(screen.getByText(buildVerdictReply(trTy).mode)).toBeTruthy();

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

  it('карточка от детекции — постоянная, без «Вернуться к разбору»', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene('хочу умереть');
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    expect(screen.queryByText('Вернуться к разбору ▲')).toBeNull();
  });
});

// Регрессия прода 2026-08-31 (фидбек владельца с телефона: «кнопка плохо
// сейчас просто кидает на главную»): onHardNow={close} в CaseFlowOverlay
// закрывал поток — кризисный путь (правило №7) выбрасывал человека из
// разбора вместо помощи. Теперь строка открывает карточку с телефоном
// доверия НА МЕСТЕ, «Вернуться к разбору ▲» её прячет, черновик цел.
describe('CaseFlowSheet — «Тяжело прямо сейчас» открывает поддержку, а не выход', () => {
  it('тап показывает карточку с телефоном доверия и НЕ зовёт onClose', () => {
    const onClose = vi.fn();
    render(<CaseFlowSheet {...baseProps({ onClose })} />);

    fireEvent.click(screen.getByText(hardNowText));

    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // пока карточка открыта рукой — строки-открывашки нет
    expect(screen.queryByText(hardNowText)).toBeNull();
    // поток остался на своём экране
    expect(screen.getByText('Разобрать свой случай')).toBeTruthy();
  });

  it('«Вернуться к разбору» прячет карточку; шаг и черновик на месте', () => {
    const onClose = vi.fn();
    render(<CaseFlowSheet {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);

    fireEvent.click(screen.getByText(hardNowText));
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();

    fireEvent.click(screen.getByText('Вернуться к разбору ▲'));

    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
    expect(screen.getByText('Что случилось?')).toBeTruthy(); // тот же шаг
    expect(screen.getByPlaceholderText(SCENE_PLACEHOLDER).value).toBe(
      SCENE_TEXT,
    ); // черновик не потерян
    expect(onClose).not.toHaveBeenCalled();
  });

  it('открытие рукой прокручивает к карточке (лист длинный, она внизу)', () => {
    const scrollSpy = vi.fn();
    const proto = window.HTMLElement.prototype as unknown as {
      scrollIntoView?: () => void;
    };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = scrollSpy;
    try {
      render(<CaseFlowSheet {...baseProps()} />);
      fireEvent.click(screen.getByText(hardNowText));
      expect(scrollSpy).toHaveBeenCalled();
    } finally {
      proto.scrollIntoView = original;
    }
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

    fireEvent.click(screen.getByText(buildFramesToggle(false)));
    fireEvent.click(
      screen.getByText('Сообщение прочитано час назад. Ответа нет.'),
    );

    expect(screen.getByText(buildFrameHint(trTy))).toBeTruthy();
    expect(screen.getByText('Дальше').disabled).toBe(true);

    typeScene(
      'Сообщение прочитано час назад. Ответа нет. Мама позвонила следом',
    );
    expect(screen.getByText('Дальше').disabled).toBe(false);
  });

  it('«Скрыть примеры» сворачивает список примеров обратно', () => {
    render(<CaseFlowSheet {...baseProps()} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    fireEvent.click(screen.getByText(buildFramesToggle(false)));
    expect(
      screen.getByText('Сообщение прочитано час назад. Ответа нет.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByText(buildFramesToggle(true)));
    expect(
      screen.queryByText('Сообщение прочитано час назад. Ответа нет.'),
    ).toBeNull();
  });
});

describe('CaseFlowSheet — поле «своё» на экране порыва', () => {
  it('видно сразу (без чипа «Своё…»), текст уходит в actions на сохранении', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CaseFlowSheet {...baseProps({ onSave })} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    fireEvent.click(screen.getByText('Дальше')); // body -> impulse

    expect(screen.queryByText('Своё…')).toBeNull();
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

// Фидбек владельца 2026-08-31: «по умолчанию поле ввода, а снизу варианты».
// Поле «своё» видно сразу, чипы-«Своё…» не рендерятся, лимит тапнутых чипов
// не блокирует ввод, а стёртое «своё» не оставляет следа в приметах
// (read-after-write: сохранил → нашёл ровно то, что видел на экране).
describe('CaseFlowSheet — «своё» тела: поле по умолчанию, лимит и стирание', () => {
  it('два чипа + своё → все три приметы в записи; лимит не мешает вводу', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CaseFlowSheet {...baseProps({ onSave })} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));

    // поле видно сразу, чипа «Своё…» нет
    const ownField = screen.getByPlaceholderText('Например: сжало в груди');
    expect(screen.queryByText('Своё…')).toBeNull();

    fireEvent.click(screen.getByText('Сердце колотится'));
    fireEvent.click(screen.getByText('Дышу поверхностно'));
    // лимит 2 тапнутых исчерпан — ввод «своего» всё равно работает
    fireEvent.change(ownField, { target: { value: 'трясутся руки' } });
    // а третий чип по-прежнему блокируется
    fireEvent.click(screen.getByText('Руки холодные'));

    fireEvent.click(screen.getByText('Дальше')); // body -> impulse
    fireEvent.click(screen.getByText('Дальше')); // impulse -> criterion
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyFeelings: 'сердце колотится, дышу поверхностно, трясутся руки',
      }),
    );
  });

  it('стёртое «своё» уходит из примет', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CaseFlowSheet {...baseProps({ onSave })} />);
    fireEvent.click(screen.getByText('Разобрать свой случай'));
    typeScene(SCENE_TEXT);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));

    const ownField = screen.getByPlaceholderText('Например: сжало в груди');
    fireEvent.click(screen.getByText('Сердце колотится'));
    fireEvent.change(ownField, { target: { value: 'трясутся руки' } });
    fireEvent.change(ownField, { target: { value: '' } }); // передумал

    fireEvent.click(screen.getByText('Дальше')); // body -> impulse
    fireEvent.click(screen.getByText('Дальше')); // impulse -> criterion
    answerCriterion(true, false);
    fireEvent.click(screen.getByText('Дальше'));
    await waitFor(() =>
      expect(screen.getByText('Вот что произошло')).toBeTruthy(),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ bodyFeelings: 'сердце колотится' }),
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
    expect(screen.getByText(CRITERION_TITLE)).toBeTruthy();

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
