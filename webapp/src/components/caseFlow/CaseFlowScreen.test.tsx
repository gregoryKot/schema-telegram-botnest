// @vitest-environment jsdom
// «Что случилось» в три шага (этап 4 простого клиента): путь целиком, «Не
// похоже», ошибка сохранения, кризис, «ровный день». Состояние потока
// проверяет useCaseQuickFlow.test.ts в shared; здесь — экраны и их связка.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CaseFlowScreen } from './CaseFlowScreen';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import type { CaseQuickProps } from '../../../../shared/src/case/quick/caseQuick';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({
  api: { trackEvent: (...args: unknown[]) => trackEvent(...args) },
}));
vi.mock('../practice/QuickPracticeSheet', () => ({
  QuickPracticeSheet: (p: { id: string; onClose: () => void }) => (
    <button onClick={p.onClose}>practice-{p.id}</button>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  trackEvent.mockClear();
});
afterEach(() => cleanup());

const SCENE = 'Она ответила одним словом';
const HARD_NOW = 'Тяжело прямо сейчас →';

function props(over: Partial<CaseQuickProps> = {}): CaseQuickProps {
  return {
    onSave: vi.fn().mockResolvedValue(undefined),
    onSaveCard: vi.fn().mockResolvedValue(undefined),
    onOpenMap: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
}

function renderFlow(over: Partial<CaseQuickProps> = {}) {
  const p = props(over);
  render(
    <MemoryRouter>
      <CaseFlowScreen {...p} />
    </MemoryRouter>,
  );
  return p;
}

const typeScene = (text: string) =>
  fireEvent.change(screen.getByLabelText('Что случилось?'), {
    target: { value: text },
  });
const click = (text: string | RegExp) =>
  fireEvent.click(screen.getByText(text));

/** Сцена → «Страшно, тревожно» → «Свернуть разговор» → итог. */
function driveToResult() {
  typeScene(SCENE);
  click('Дальше');
  click('Страшно, тревожно');
  click('Дальше');
  click('Свернуть разговор');
  click('Что это было?');
}

describe('CaseFlowScreen — три шага и итог', () => {
  it('шаг 1: «Дальше» закрыта, пока поле пусто; подпись и подсказка на месте', () => {
    renderFlow();
    expect(
      screen.getByText(
        'Крупное необязательно. Хватит мелочи: сообщение, взгляд, тишина в ответ.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Подробности не нужны — дальше будут вопросы.'),
    ).toBeTruthy();
    expect((screen.getByText('Дальше') as HTMLButtonElement).disabled).toBe(
      true,
    );
    typeScene('   ');
    expect((screen.getByText('Дальше') as HTMLButtonElement).disabled).toBe(
      true,
    );
    typeScene(SCENE);
    expect((screen.getByText('Дальше') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('путь целиком: запись с fromCase, карточка режима, «Записано» и выход на карту', async () => {
    const p = renderFlow();
    expect(trackEvent).toHaveBeenCalledWith('case_started', {});
    driveToResult();

    // итог: предложенный по порыву режим, описание, что собрали, дыхание
    expect(screen.getByText('Похоже на режим')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Избегающий Защитник' }),
    ).toBeTruthy();
    expect(screen.getByText(/Что ему нужно:/)).toBeTruthy();
    expect(screen.getByText(SCENE)).toBeTruthy();
    expect(screen.getByText('Страшно, тревожно')).toBeTruthy();
    expect(screen.getByText('свернуть разговор')).toBeTruthy();
    click('Минута дыхания 4-4-6');
    expect(screen.getByText('practice-breathing')).toBeTruthy();
    click('practice-breathing');
    expect(screen.queryByText('practice-breathing')).toBeNull();

    click('Сохранить');
    await screen.findByText('Записано');
    expect(p.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'avoidant_protector',
        situation: SCENE,
        feelings: 'Страшно, тревожно',
        actions: 'свернуть разговор',
        fromCase: true,
      }),
    );
    expect(p.onSaveCard).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'avoidant_protector' }),
    );
    expect(trackEvent).toHaveBeenCalledWith('case_finished', {
      modeId: 'avoidant_protector',
    });
    expect(
      screen.getByText(
        'Теперь это есть в записях. Через 2–3 разбора видно, что повторяется.',
      ),
    ).toBeTruthy();

    click('Карта себя');
    expect(p.onOpenMap).toHaveBeenCalledTimes(1);
  });

  it('«Не похоже — другие режимы»: выбранный режим возвращается на итог и уходит в запись', async () => {
    const p = renderFlow();
    driveToResult();
    click('Не похоже — другие режимы');
    click('Страшно, тревожно');
    click('Одиноко, страшно, грустно');
    expect(
      screen.getByRole('heading', { name: 'Уязвимый Ребёнок' }),
    ).toBeTruthy();
    click('Сохранить');
    await screen.findByText('Записано');
    expect(p.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'vulnerable_child' }),
    );
    expect(trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: false,
    });
  });

  it('ошибка сохранения: остаёмся на итоге со строкой ошибки, повтор проходит', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValue(undefined);
    renderFlow({ onSave });
    driveToResult();
    click('Сохранить');
    await screen.findByText(/Не удалось сохранить/);
    expect(screen.getByText('Похоже на режим')).toBeTruthy();
    expect(screen.queryByText('Записано')).toBeNull();
    click('Сохранить');
    await screen.findByText('Записано');
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('«Своё…» в теле и порыве попадает в итог и запись', async () => {
    const p = renderFlow();
    typeScene(SCENE);
    click('Дальше');
    click('Страшно, тревожно');
    fireEvent.change(screen.getByPlaceholderText('Например: сжало в груди'), {
      target: { value: 'сжало горло' },
    });
    click('Дальше');
    fireEvent.change(
      screen.getByPlaceholderText('Например: хотелось всё бросить'),
      { target: { value: 'исчезнуть' } },
    );
    click('Что это было?');
    expect(screen.getByText(/сжало горло/)).toBeTruthy();
    click('Сохранить');
    await screen.findByText('Записано');
    expect(p.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyFeelings: 'сжало горло',
        actions: 'исчезнуть',
      }),
    );
  });

  it('«Назад» ведёт по шагам, текст сцены на месте; с первого шага — выход', () => {
    const p = renderFlow();
    typeScene(SCENE);
    click('Дальше');
    click('Назад');
    expect(
      (screen.getByLabelText('Что случилось?') as HTMLTextAreaElement).value,
    ).toBe(SCENE);
    click('Назад');
    expect(p.onClose).toHaveBeenCalled();
  });

  it('«Дальше» на втором шаге закрыта, пока не выбраны ворота; тело появляется после выбора', () => {
    renderFlow();
    typeScene(SCENE);
    click('Дальше');
    expect((screen.getByText('Дальше') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.queryByPlaceholderText('Например: сжало в груди')).toBeNull();
    click('Грустно, одиноко');
    expect(screen.getByPlaceholderText('Например: сжало в груди')).toBeTruthy();
    expect((screen.getByText('Дальше') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('черновик: после закрытия на втором шаге поток открывается на нём же', () => {
    renderFlow();
    typeScene(SCENE);
    click('Дальше');
    cleanup();
    renderFlow();
    expect(screen.getByText('Что внутри?')).toBeTruthy();
  });
});

describe('CaseFlowScreen — ровный день', () => {
  it('«Спокойно, хорошо» ведёт на «Ровный день — тоже запись»; «Записать так» пишет Здорового Взрослого', async () => {
    const p = renderFlow();
    typeScene('Тихий вечер');
    click('Дальше');
    click('Спокойно, хорошо');
    expect(screen.getByText('Ровный день — тоже запись')).toBeTruthy();
    click('Записать так');
    await screen.findByText('Записано');
    expect(p.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'healthy_adult',
        situation: 'Тихий вечер',
        fromCase: true,
      }),
    );
    expect(p.onSaveCard).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Здоровый Взрослый' }),
    ).toBeTruthy();
  });

  it('«Назад» с «ровного дня» возвращает к воротам', () => {
    renderFlow();
    typeScene('Тихий вечер');
    click('Дальше');
    click('Спокойно, хорошо');
    click('Назад');
    expect(screen.getByText('Что внутри?')).toBeTruthy();
    expect((screen.getByText('Дальше') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('CaseFlowScreen — кризис и «Тяжело прямо сейчас» (правило №7)', () => {
  it('кризисная фраза в сцене показывает CrisisCard', () => {
    renderFlow();
    typeScene('хочу умереть');
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    expect(screen.queryByText('Вернуться к разбору ▲')).toBeNull();
  });

  it('нейтральный текст карточку не вызывает', () => {
    renderFlow();
    typeScene(SCENE);
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('кризисное «своё» на втором шаге тоже показывает карточку', () => {
    renderFlow();
    typeScene(SCENE);
    click('Дальше');
    click('Страшно, тревожно');
    fireEvent.change(screen.getByPlaceholderText('Например: сжало в груди'), {
      target: { value: 'хочу умереть' },
    });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('строка «Тяжело прямо сейчас» есть на всех шагах, тап открывает поддержку на месте и не закрывает поток', () => {
    const p = renderFlow();
    const steps = [
      () => {},
      () => {
        typeScene(SCENE);
        click('Дальше');
      },
      () => {
        click('Страшно, тревожно');
        click('Дальше');
      },
      () => {
        click('Свернуть разговор');
        click('Что это было?');
      },
    ];
    for (const next of steps) {
      next();
      expect(screen.getByText(HARD_NOW)).toBeTruthy();
    }
    click(HARD_NOW);
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    expect(p.onClose).not.toHaveBeenCalled();
    click('Вернуться к разбору ▲');
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
    expect(screen.getByText('Похоже на режим')).toBeTruthy();
  });
});

describe('CaseFlowScreen — требует Router (useHistorySheet)', () => {
  it('падает без MemoryRouter', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CaseFlowScreen {...props()} />)).toThrow();
    spy.mockRestore();
  });
});
