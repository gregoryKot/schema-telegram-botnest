// @vitest-environment jsdom
// Хук сохранения потока «Разбор случая» (criterion → recognition → name →
// done), поднятый в shared из schema-miniapp 2026-08 (правило №3 CLAUDE.md).
// useCaseFlowSave принимает готовое состояние (CaseFlowBaseState) — тестируем
// его в связке с настоящим useCaseFlowState (та же композиция, что у
// площадок в их useCaseFlow.ts), а не с рукописной заглушкой состояния:
// иначе тест держит собственное, неизбежно расходящееся представление формы
// CaseFlowBaseState вместо проверки реального контракта между хуками.
//
// Отдельный акцент — read-after-write маппинга (onSave обязан получить то,
// что человек реально выбрал, не сырые id) и guard по `saving`: у сохранения
// записи и карточки по одному вызову с двумя потенциальными источниками
// (двойной тап, повторный рендер) — раздвоенный запрос означает вторую
// запись в дневнике на один разбор.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCaseFlowState, type CaseFlowStateDeps } from './useCaseFlowState';
import { useCaseFlowSave } from './useCaseFlowSave';
import type { CaseFlowFields, CaseFlowSheetProps } from './caseFlowTypes';

beforeEach(() => {
  localStorage.clear();
});

type SaveProps = Pick<
  CaseFlowSheetProps,
  'caseCount' | 'onSave' | 'onSaveCard' | 'onDoubt'
>;

const deps = (): CaseFlowStateDeps => ({ trackEvent: vi.fn() });

function baseProps(over: Partial<SaveProps> = {}): SaveProps {
  return {
    caseCount: 0,
    onSave: vi.fn().mockResolvedValue(undefined),
    onSaveCard: vi.fn().mockResolvedValue(undefined),
    onDoubt: vi.fn(),
    ...over,
  };
}

/** Композиция обоих хуков — ровно то, что делает каждая площадка в своём
 *  useCaseFlow.ts (schema-miniapp/src/components/caseFlow/useCaseFlow.ts). */
function setup(props: SaveProps = baseProps(), d: CaseFlowStateDeps = deps()) {
  const view = renderHook(() => {
    const state = useCaseFlowState(vi.fn(), vi.fn(), vi.fn(), d);
    const save = useCaseFlowSave(state, props, d);
    return { ...state, ...save };
  });
  return { ...view, deps: d, props };
}

type FlowResult = ReturnType<typeof setup>['result'];

/** Прыгает сразу на шаг criterion — минимальный набор полей для маппинга,
 *  без прохождения платформенной навигации выбора режима (она вне shared). */
function fillToCriterion(
  result: FlowResult,
  over: Partial<CaseFlowFields> = {},
) {
  act(() => {
    result.current.patch({
      scene: 'Мама написала резким тоном в переписке',
      gateId: 'fear',
      modeId: 'vulnerable_child',
      bodyChipIds: ['fear_heartbeat'],
      impulseChipIds: ['impulse_close'],
      criterion: { biggerThanCause: true, talkedDown: false }, // -> mode
      ...over,
    });
    result.current.setStep('criterion'); // экран, с которого зовётся handleCriterionNext
  });
}

describe('handleCriterionNext — маппинг полей и событие', () => {
  it('вердикт mode: onSave получает situation/bodyFeelings/actions из ответов, шлёт case_criterion', async () => {
    const d = deps();
    const props = baseProps();
    const { result } = setup(props, d);
    fillToCriterion(result);

    await act(async () => {
      await result.current.handleCriterionNext();
    });

    expect(props.onSave).toHaveBeenCalledWith({
      modeId: 'vulnerable_child',
      situation: 'Мама написала резким тоном в переписке',
      bodyFeelings: 'сердце колотится',
      actions: 'свернуть разговор',
    });
    expect(d.trackEvent).toHaveBeenCalledWith('case_criterion', {
      verdict: 'mode',
    });
    expect(result.current.step).toBe('recognition');
    expect(result.current.verdict).toBe('mode');
  });

  it('gateId не задан (null) — маппинг чипов идёт по воротам "unknown", не бросает', async () => {
    const props = baseProps();
    const { result } = setup(props);
    fillToCriterion(result, {
      gateId: null,
      bodyChipIds: ['unknown_gaze'],
      impulseChipIds: ['impulse_close'],
    });

    await act(async () => {
      await result.current.handleCriterionNext();
    });

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ bodyFeelings: 'взгляд расфокусирован' }),
    );
  });

  it('отказ onSave (промис отклонён) не оставляет поток в вечном saving и не продвигает шаг', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    const props = baseProps({ onSave });
    const { result } = setup(props);
    fillToCriterion(result);

    await act(async () => {
      await result.current.handleCriterionNext();
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.step).toBe('criterion');
  });

  it('повторный вызов во время сохранения не дублирует onSave (guard по saving)', async () => {
    let resolveSave: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((res) => (resolveSave = res)));
    const props = baseProps({ onSave });
    const { result } = setup(props);
    fillToCriterion(result);

    act(() => {
      void result.current.handleCriterionNext();
    });
    expect(result.current.saving).toBe(true);

    act(() => {
      void result.current.handleCriterionNext(); // должен выйти по guard
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.saving).toBe(false);
  });
});

describe('вердикт и карточка режима (onSaveCard)', () => {
  it("вердикт 'ordinary' сохраняет запись, но НЕ заводит карточку режима", async () => {
    const props = baseProps();
    const { result } = setup(props);
    fillToCriterion(result, {
      criterion: { biggerThanCause: false, talkedDown: true }, // -> ordinary
    });

    await act(async () => {
      await result.current.handleCriterionNext();
    });
    expect(result.current.verdict).toBe('ordinary');
    expect(props.onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.confirmName('', 'skipped');
    });
    expect(props.onSaveCard).not.toHaveBeenCalled();
    expect(result.current.step).toBe('done');
  });

  it("вердикт 'mode' — confirmName заводит карточку режима через onSaveCard", async () => {
    const props = baseProps();
    const { result } = setup(props);
    fillToCriterion(result); // biggerThanCause:true, talkedDown:false -> mode

    await act(async () => {
      await result.current.handleCriterionNext();
    });

    await act(async () => {
      await result.current.confirmName('Стена', 'own');
    });

    expect(props.onSaveCard).toHaveBeenCalledWith({
      modeId: 'vulnerable_child',
      alias: 'Стена',
      triggers: 'Мама написала резким тоном в переписке',
      feelings: 'сердце колотится',
      behavior: 'свернуть разговор',
    });
    expect(result.current.step).toBe('done');
  });

  it('отказ onSaveCard (промис отклонён) не оставляет карточку в вечном saving', async () => {
    const onSaveCard = vi.fn().mockRejectedValue(new Error('offline'));
    const props = baseProps({ onSaveCard });
    const { result } = setup(props);
    fillToCriterion(result);
    await act(async () => {
      await result.current.handleCriterionNext();
    });

    await act(async () => {
      await result.current.confirmName('Стена', 'own');
    });

    expect(result.current.saving).toBe(false);
    // случай всё равно доведён до конца — карточка не завелась, но поток не завис
    expect(result.current.step).toBe('done');
  });

  it('confirmName: повторный вызов во время сохранения карточки не дублирует onSaveCard', async () => {
    let resolveCard: () => void = () => {};
    const onSaveCard = vi.fn(
      () => new Promise<void>((res) => (resolveCard = res)),
    );
    const props = baseProps({ onSaveCard });
    const { result } = setup(props);
    fillToCriterion(result);
    await act(async () => {
      await result.current.handleCriterionNext();
    });

    act(() => {
      void result.current.confirmName('Стена', 'own');
    });
    expect(result.current.saving).toBe(true);

    act(() => {
      void result.current.confirmName('Стена', 'own'); // guard
    });
    expect(onSaveCard).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCard();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.saving).toBe(false);
  });
});

describe('handleRecognitionNext / handleDoubt — согласие с узнаванием', () => {
  async function toRecognition(result: FlowResult) {
    fillToCriterion(result);
    await act(async () => {
      await result.current.handleCriterionNext();
    });
  }

  it('handleRecognitionNext: agreed:true, переход на шаг name', async () => {
    const d = deps();
    const { result } = setup(baseProps(), d);
    await toRecognition(result);

    act(() => result.current.handleRecognitionNext());
    expect(d.trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: true,
    });
    expect(result.current.step).toBe('name');
  });

  it('handleDoubt: agreed:false, зовёт props.onDoubt, шаг не меняется хуком', async () => {
    const d = deps();
    const props = baseProps();
    const { result } = setup(props, d);
    await toRecognition(result);

    act(() => result.current.handleDoubt());
    expect(props.onDoubt).toHaveBeenCalledTimes(1);
    expect(d.trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: false,
    });
  });
});
