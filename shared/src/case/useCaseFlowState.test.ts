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
  const view = renderHook(() => useCaseFlowState(onClose, onSteadyDay, d));
  return { ...view, onClose, onSteadyDay, deps: d };
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

  it('handleSteadyDay зовёт onSteadyDay и закрывает поток', () => {
    const { result, onSteadyDay, onClose } = setup();
    act(() => result.current.handleSteadyDay());
    expect(onSteadyDay).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// Регрессия прода 2026-08-31 (фидбек владельца с телефона: «кнопка плохо
// сейчас просто кидает на главную»): «Тяжело прямо сейчас →» звала onHardNow,
// которым обе площадки ЗАКРЫВАЛИ поток — кризисный путь (правило №7)
// выбрасывал человека из разбора вместо помощи. Теперь тап открывает карточку
// поддержки на месте (hardNow), «Вернуться к разбору ▲» её прячет, а шаг и
// поля не трогаются.
describe('useCaseFlowState — «Тяжело прямо сейчас» больше не выход из потока', () => {
  it('handleHardNow ставит hardNow и НЕ закрывает поток', () => {
    const { result, onClose } = setup();
    act(() => result.current.goToScene());
    act(() => result.current.patch({ scene: 'текст не должен пропасть' }));

    act(() => result.current.handleHardNow());

    expect(result.current.hardNow).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.step).toBe('scene'); // разбор на том же шаге
    expect(result.current.fields.scene).toBe('текст не должен пропасть');
  });

  it('closeSupport снимает hardNow, шаг и поля на месте', () => {
    const { result, onClose } = setup();
    act(() => result.current.goToScene());
    act(() => result.current.patch({ scene: 'черновик' }));
    act(() => result.current.handleHardNow());

    act(() => result.current.closeSupport());

    expect(result.current.hardNow).toBe(false);
    expect(result.current.step).toBe('scene');
    expect(result.current.fields.scene).toBe('черновик');
    expect(onClose).not.toHaveBeenCalled();
  });
});

// «Своё» — поле видно всегда (фидбек владельца 2026-08-31), признак выбора —
// непустой текст: id `*_own` обязан сам появляться/исчезать в selectedIds,
// иначе набранный текст не доедет до примет (chipLabels ищет чип по id).
describe('useCaseFlowState — автосинхронизация «своего» с selectedIds', () => {
  it('непустой bodyOwn добавляет own-id текущих ворот, пустой — убирает', () => {
    const { result } = setup();
    act(() => result.current.patch({ gateId: 'fear' }));

    act(() => result.current.patch({ bodyOwn: 'трясутся руки' }));
    expect(result.current.fields.bodyChipIds).toContain('fear_own');

    act(() => result.current.patch({ bodyOwn: '   ' }));
    expect(result.current.fields.bodyChipIds).not.toContain('fear_own');
  });

  it('свой текст + 2 тапнутых чипа: все три приметы в selectedIds, own — последним', () => {
    const { result } = setup();
    act(() => result.current.patch({ gateId: 'fear' }));
    act(() => result.current.toggleBodyChip('fear_heartbeat'));
    act(() => result.current.patch({ bodyOwn: 'трясутся руки' }));
    act(() => result.current.toggleBodyChip('fear_stomach'));

    expect(result.current.fields.bodyChipIds).toEqual([
      'fear_heartbeat',
      'fear_stomach',
      'fear_own',
    ]);
  });

  it('лимит 2 относится к тапнутым: свой текст слот не занимает и не блокируется', () => {
    const { result } = setup();
    act(() => result.current.patch({ gateId: 'fear' }));
    act(() => result.current.toggleBodyChip('fear_heartbeat'));
    act(() => result.current.toggleBodyChip('fear_stomach'));

    // лимит тапнутых исчерпан, но «своё» всё равно добавляется
    act(() => result.current.patch({ bodyOwn: 'трясутся руки' }));
    expect(result.current.fields.bodyChipIds).toHaveLength(3);

    // а третий тапнутый чип по-прежнему блокируется
    act(() => result.current.toggleBodyChip('fear_cold_hands'));
    expect(result.current.fields.bodyChipIds).not.toContain('fear_cold_hands');
  });

  it('смена ворот переносит own-id: fear_own → sad_own, текст не пропадает', () => {
    const { result } = setup();
    act(() => result.current.patch({ gateId: 'fear' }));
    act(() => result.current.patch({ bodyOwn: 'трясутся руки' }));
    expect(result.current.fields.bodyChipIds).toContain('fear_own');

    act(() => result.current.patch({ gateId: 'sad' }));
    expect(result.current.fields.bodyChipIds).not.toContain('fear_own');
    expect(result.current.fields.bodyChipIds).toContain('sad_own');
    expect(result.current.fields.bodyOwn).toBe('трясутся руки');
  });

  it('черновик со «своим», но без own-id (старый формат) — id доставляется при старте', () => {
    saveCaseDraft({
      ...INITIAL_CASE_FIELDS,
      step: 'body',
      gateId: 'fear',
      bodyOwn: 'трясутся руки',
    });
    const { result } = setup();
    expect(result.current.fields.bodyChipIds).toContain('fear_own');
  });

  it('порыв: own-id идёт тем же путём, что тап — с пересчётом второй двери', () => {
    const { result } = setup();
    act(() => result.current.patch({ modeId: 'vulnerable_child' }));
    act(() => result.current.toggleImpulseChip('impulse_close'));
    expect(result.current.secondDoorModeId).toBe('avoidant_protector');

    act(() => result.current.patch({ impulseOwn: 'хлопнуть дверью' }));
    expect(result.current.fields.impulseChipIds).toEqual([
      'impulse_close',
      'impulse_own',
    ]);
    // пересчёт не потерял уже найденную дверь (impulse_own двери не даёт)
    expect(result.current.secondDoorModeId).toBe('avoidant_protector');

    act(() => result.current.patch({ impulseOwn: '' }));
    expect(result.current.fields.impulseChipIds).toEqual(['impulse_close']);
  });

  it('порыв: лимит 3 не мешает «своему» и не считает его', () => {
    const { result } = setup();
    act(() => result.current.toggleImpulseChip('impulse_close'));
    act(() => result.current.toggleImpulseChip('impulse_phone'));
    act(() => result.current.toggleImpulseChip('impulse_silence'));
    act(() => result.current.patch({ impulseOwn: 'своё' }));
    expect(result.current.fields.impulseChipIds).toHaveLength(4);

    act(() => result.current.toggleImpulseChip('impulse_sharp'));
    expect(result.current.fields.impulseChipIds).not.toContain('impulse_sharp');
  });
});
