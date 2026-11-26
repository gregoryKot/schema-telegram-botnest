// @vitest-environment jsdom
// Карта себя (webapp): экран отвечает на «где я» и «что дальше» ровно одной
// кнопкой, пустые полосы не выглядят долгом (никаких нулей/процентов/упрёков
// за пропуски).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SelfMapScreen } from './SelfMapScreen';
import { getSchemaById } from '../../schemaTherapyData';
import type { MapInput } from '../../../../shared/src/map/mapVm';
import type { NextStepInput } from '../../../../shared/src/case/caseNextStep';

const TODAY = '2026-08-28';
const daysAgo = (n: number): string =>
  new Date(Date.parse(TODAY) - n * 86400000).toISOString().slice(0, 10);

const emptyMap: MapInput = { cases: [], notes: [], warmWords: [], ysqDone: false, today: TODAY };
const emptyNext: NextStepInput = {
  caseCount: 0,
  modeStats: [],
  hasChildMode: false,
  hasCopingMode: false,
  healthyResponseCount: 0,
  repeatedTrigger: false,
  repeatedNeed: false,
  ysqDone: false,
  today: TODAY,
};

function renderMap(map: MapInput, next: NextStepInput, over = {}) {
  const props = {
    map,
    next,
    origins: { ysqSchemaIds: [], manualSchemaIds: [], ysqDone: false },
    onBack: vi.fn(),
    onPickMode: vi.fn(),
    onPickSchema: vi.fn(),
    onOpenPatterns: vi.fn(),
    onStartTest: vi.fn(),
    onNextStep: vi.fn(),
    ...over,
  };
  render(<SelfMapScreen {...props} />);
  return props;
}

afterEach(cleanup);

describe('SelfMapScreen', () => {
  it('на чистой карте зовёт сделать первый разбор и не показывает нулей', () => {
    renderMap(emptyMap, emptyNext);
    expect(screen.getByText(/Разобрать случай/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/0 разборов|0 случаев|0%|NaN/);
  });

  it('карта помечена черновиком', () => {
    renderMap(emptyMap, emptyNext);
    expect(screen.getByText(/Черновик/)).toBeTruthy();
  });

  it('показывает разобранный режим его собственным именем', () => {
    renderMap(
      {
        ...emptyMap,
        cases: [
          { modeId: 'detached_protector', at: daysAgo(1) },
          { modeId: 'detached_protector', at: daysAgo(3) },
        ],
        notes: [{ modeId: 'detached_protector', alias: 'Стена', hasCard: false }],
      },
      {
        ...emptyNext,
        caseCount: 2,
        modeStats: [
          { modeId: 'detached_protector', alias: 'Стена', count: 2, hasCard: false, lastAt: daysAgo(1) },
        ],
        hasCopingMode: true,
      },
    );
    expect(screen.getByText('Стена')).toBeTruthy();
    // «Где я сейчас» через glue: «в 2 из 2» не рвётся на предлоге и числе
    expect(document.querySelector('.sm-where-text')!.textContent).toContain('в\u00a02\u00a0из\u00a02');
  });

  it('«что дальше» — ровно одна кнопка, тап отдаёт наверх id шага', () => {
    const props = renderMap(emptyMap, emptyNext);
    expect(screen.getAllByRole('button', { name: /Разобрать случай/ })).toHaveLength(1);
    fireEvent.click(screen.getByText(/Разобрать случай/));
    expect(props.onNextStep).toHaveBeenCalledTimes(1);
  });

  it('тап по режиму открывает его', () => {
    const props = renderMap(
      {
        ...emptyMap,
        cases: [{ modeId: 'detached_protector', at: daysAgo(1) }],
        notes: [{ modeId: 'detached_protector', alias: 'Стена', hasCard: false }],
      },
      { ...emptyNext, caseCount: 1 },
    );
    fireEvent.click(screen.getByText('Стена'));
    expect(props.onPickMode).toHaveBeenCalledWith('detached_protector');
  });

  it('затихший режим показан с давностью, а не вычеркнут', () => {
    renderMap(
      {
        ...emptyMap,
        cases: [{ modeId: 'detached_protector', at: daysAgo(45) }],
        notes: [{ modeId: 'detached_protector', alias: 'Стена', hasCard: true }],
      },
      { ...emptyNext, caseCount: 1 },
    );
    expect(screen.getByText(/Не появлялся в записях 45/)).toBeTruthy();
  });

  it('карточка примет без единого разбора показывает «Приметы собраны, разборов пока нет»', () => {
    // Карточка режима могла быть собрана раньше, чем поймался случай
    // (collectModeItems, shared/src/map/mapVm.ts) — count===0 не должен
    // читаться как «0 случаев», это другой текст с другим смыслом.
    renderMap(
      { ...emptyMap, notes: [{ modeId: 'detached_protector', alias: 'Стена', hasCard: true }] },
      emptyNext,
    );
    expect(screen.getByText('Приметы собраны, разборов пока нет')).toBeTruthy();
  });

  it('на пустой карте «Разобрать случай» стоит в DOM раньше любой полосы', () => {
    renderMap({ ...emptyMap, warmWords: ['Побудь, я рядом'] }, emptyNext, {
      origins: { ysqSchemaIds: ['abandonment'], manualSchemaIds: [], ysqDone: true },
    });
    const btn = screen.getByRole('button', { name: /Разобрать случай/ });
    const lane = document.querySelector('.sm-lane')!;
    expect(btn.compareDocumentPosition(lane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('на пустой карте подсказка про первую метку одна', () => {
    renderMap(emptyMap, emptyNext);
    expect(screen.getAllByText(/Первый разбор поставит первую метку/)).toHaveLength(1);
    expect(document.querySelector('.sm-where')).toBeNull();
  });

  it('схема в «Откуда тянется» открывается тапом', () => {
    const props = renderMap(emptyMap, emptyNext, {
      origins: { ysqSchemaIds: ['abandonment'], manualSchemaIds: [], ysqDone: true },
    });
    fireEvent.click(screen.getByText(getSchemaById('abandonment')!.name));
    expect(props.onPickSchema).toHaveBeenCalledWith('abandonment');
  });

  it('без схем и без теста строка ведёт в тест', () => {
    const props = renderMap(
      { ...emptyMap, cases: [{ modeId: 'detached_protector', at: daysAgo(1) }] },
      { ...emptyNext, caseCount: 1 },
    );
    fireEvent.click(screen.getByText('Пройти тест на схемы'));
    expect(props.onStartTest).toHaveBeenCalledTimes(1);
  });

  it('«Все режимы и схемы» ведёт в «Мои паттерны»', () => {
    const props = renderMap(emptyMap, emptyNext);
    fireEvent.click(screen.getByText(/Все режимы и схемы/));
    expect(props.onOpenPatterns).toHaveBeenCalledTimes(1);
  });
});
