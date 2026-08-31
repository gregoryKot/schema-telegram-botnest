// @vitest-environment jsdom
// Хук состояния потока «Разбор случая» (шаги hook…criterion), поднятый в
// shared из schema-miniapp 2026-08 (правило №3 CLAUDE.md) — тесты остались
// только на UI-уровне мини-аппа (CaseFlowSheet.test.tsx), покрытие самого
// shared-пакета их не видело. Проверяем то, что раньше проверялось только
// косвенно через клики по экрану: восстановление черновика (в т.ч. откат
// НАЗАД на hook для уже сохранённых шагов — реальный источник бага, если бы
// поток попытался «доиграть» уже записанный разбор), однократность
// case_started при повторных заходах, и лимиты чипов.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCaseFlowState, type CaseFlowStateDeps } from './useCaseFlowState';
import { saveCaseDraft } from './caseDraft';
import { INITIAL_CASE_FIELDS } from './caseFlowTypes';

beforeEach(() => {
  localStorage.clear();
});

const deps = (): CaseFlowStateDeps => ({ trackEvent: vi.fn() });

function setup(d: CaseFlowStateDeps = deps()) {
  const onClose = vi.fn();
  const onSteadyDay = vi.fn();
  const onHardNow = vi.fn();
  const view = renderHook(() =>
    useCaseFlowState(onClose, onSteadyDay, onHardNow, d),
  );
  return { ...view, onClose, onSteadyDay, onHardNow, deps: d };
}

describe('useCaseFlowState — восстановление из черновика при старте', () => {
  it('пустой черновик (ничего не сохранено) — старт с шага hook, поля дефолтные', () => {
    const { result } = setup();
    expect(result.current.step).toBe('hook');
    expect(result.current.fields).toEqual(INITIAL_CASE_FIELDS);
  });

  it('черновик на середине (body) — возобновление с него, поля read-after-write', () => {
    saveCaseDraft({ ...INITIAL_CASE_FIELDS, step: 'body', scene: 'заметка' });
    const { result } = setup();
    expect(result.current.step).toBe('body');
    expect(result.current.fields.scene).toBe('заметка');
  });

  it.each(['recognition', 'name', 'done'] as const)(
    'черновик на шаге "%s" (запись уже сохранена) — откат на hook, поток не «доигрывает» сохранённый разбор',
    (step) => {
      saveCaseDraft({ ...INITIAL_CASE_FIELDS, step, alias: 'Стена' });
      const { result } = setup();
      expect(result.current.step).toBe('hook');
    },
  );
});

describe('useCaseFlowState — goToScene шлёт case_started ровно один раз', () => {
  it('повторные вызовы (двойной тап) не дублируют событие', () => {
    const d = deps();
    const { result } = setup(d);
    act(() => result.current.goToScene());
    act(() => result.current.goToScene());
    act(() => result.current.goToScene());
    expect(d.trackEvent).toHaveBeenCalledTimes(1);
    expect(d.trackEvent).toHaveBeenCalledWith('case_started', {});
    expect(result.current.step).toBe('scene');
  });
});

describe('useCaseFlowState — handleSceneNext: источник сцены в аналитике', () => {
  it('своя сцена (sceneFromFrame=false по умолчанию) — source: own', () => {
    const d = deps();
    const { result } = setup(d);
    act(() => result.current.handleSceneNext());
    expect(d.trackEvent).toHaveBeenCalledWith('case_scene', { source: 'own' });
    expect(result.current.step).toBe('gate');
  });

  it('сцена начата с готовой рамки (sceneFromFrame=true) — source: frame', () => {
    const d = deps();
    const { result } = setup(d);
    act(() => result.current.patch({ sceneFromFrame: true }));
    act(() => result.current.handleSceneNext());
    expect(d.trackEvent).toHaveBeenCalledWith('case_scene', {
      source: 'frame',
    });
  });
});

describe('useCaseFlowState — handleBodyNext/handleImpulseNext: переходы шагов', () => {
  it('handleBodyNext ведёт на impulse, handleImpulseNext — на criterion', () => {
    const { result } = setup();
    act(() => result.current.handleBodyNext());
    expect(result.current.step).toBe('impulse');
    act(() => result.current.handleImpulseNext());
    expect(result.current.step).toBe('criterion');
  });
});

describe('useCaseFlowState — handleCriterionAnswer', () => {
  it('меняет только указанный ключ критерия, второй не трогает', () => {
    const { result } = setup();
    act(() => result.current.handleCriterionAnswer('biggerThanCause', true));
    expect(result.current.fields.criterion).toEqual({
      biggerThanCause: true,
      talkedDown: null,
    });
    act(() => result.current.handleCriterionAnswer('talkedDown', false));
    expect(result.current.fields.criterion).toEqual({
      biggerThanCause: true,
      talkedDown: false,
    });
  });
});

describe('useCaseFlowState — toggleBodyChip: максимум 2', () => {
  it('третий чип блокируется, повторный тап уже выбранного снимает его', () => {
    const { result } = setup();
    act(() => result.current.toggleBodyChip('a'));
    expect(result.current.fields.bodyChipIds).toEqual(['a']);
    act(() => result.current.toggleBodyChip('b'));
    expect(result.current.fields.bodyChipIds).toEqual(['a', 'b']);

    act(() => result.current.toggleBodyChip('c'));
    expect(result.current.fields.bodyChipIds).toEqual(['a', 'b']); // не выросло

    act(() => result.current.toggleBodyChip('a'));
    expect(result.current.fields.bodyChipIds).toEqual(['b']); // снят
  });
});

describe('useCaseFlowState — toggleImpulseChip: максимум 3 и вторая дверь', () => {
  it('четвёртый чип блокируется', () => {
    const { result } = setup();
    act(() => result.current.toggleImpulseChip('impulse_close'));
    act(() => result.current.toggleImpulseChip('impulse_phone'));
    act(() => result.current.toggleImpulseChip('impulse_silence'));
    expect(result.current.fields.impulseChipIds).toHaveLength(3);

    act(() => result.current.toggleImpulseChip('impulse_sharp'));
    expect(result.current.fields.impulseChipIds).toHaveLength(3);
    expect(result.current.fields.impulseChipIds).not.toContain('impulse_sharp');
  });

  it('порыв указывает на другой режим — secondDoorModeId подставляется; снятие выбора убирает подсказку', () => {
    const { result } = setup();
    act(() => result.current.patch({ modeId: 'vulnerable_child' }));
    expect(result.current.secondDoorModeId).toBeNull();

    // impulse_close -> avoidant_protector (IMPULSE_SECOND_DOOR), отличается
    // от уже выбранного vulnerable_child — вторая дверь подсвечивается.
    act(() => result.current.toggleImpulseChip('impulse_close'));
    expect(result.current.secondDoorModeId).toBe('avoidant_protector');

    act(() => result.current.toggleImpulseChip('impulse_close')); // снять
    expect(result.current.secondDoorModeId).toBeNull();
  });

  it('порыв без расхождения (совпадает с уже выбранным режимом) — подсказки нет', () => {
    const { result } = setup();
    act(() => result.current.patch({ modeId: 'avoidant_protector' }));
    act(() => result.current.toggleImpulseChip('impulse_close')); // тот же modeId
    expect(result.current.secondDoorModeId).toBeNull();
  });
});

describe('useCaseFlowState — выходы из потока', () => {
  it('handleLater сохраняет черновик и закрывает без подтверждения', () => {
    const { result, onClose } = setup();
    act(() => result.current.goToScene());
    act(() => result.current.patch({ scene: 'коротко, но не пусто' }));
    act(() => result.current.handleLater());

    expect(onClose).toHaveBeenCalledTimes(1);
    const raw = localStorage.getItem('diary_draft_case');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved.step).toBe('scene');
    expect(saved.scene).toBe('коротко, но не пусто');
  });

  it('handleLater: запись уже сохранена (savedRef.current=true) — черновик не пересоздаётся', () => {
    // savedRef выставляет useCaseFlowSave после успешного onSave — здесь
    // достаточно мутировать сам ref (та же ссылка живёт весь рендер), не
    // поднимая второй хук: handleLater проверяет именно savedRef.current.
    const { result, onClose } = setup();
    act(() => result.current.goToScene());
    act(() => result.current.patch({ scene: 'текст' }));
    act(() => {
      result.current.savedRef.current = true;
    });
    localStorage.clear(); // убираем то, что успел записать автосейв-эффект выше

    act(() => result.current.handleLater());
    expect(localStorage.getItem('diary_draft_case')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handleHardNow зовёт onHardNow, поток не закрывается сам', () => {
    const { result, onHardNow, onClose } = setup();
    act(() => result.current.handleHardNow());
    expect(onHardNow).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handleSteadyDay зовёт onSteadyDay и закрывает поток', () => {
    const { result, onSteadyDay, onClose } = setup();
    act(() => result.current.handleSteadyDay());
    expect(onSteadyDay).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
