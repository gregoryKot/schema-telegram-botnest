// @vitest-environment jsdom
// Карта себя: экран обязан отвечать на «где я» и «что дальше» ровно одной
// кнопкой, а пустые полосы — не выглядеть долгом. Отдельно закреплено, что на
// чистой карте нет ни нулей, ни процентов, ни упрёка за пропуски: именно
// из-за такой обратной связи новичок и бросает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SelfMapScreen } from './SelfMapScreen';
import type { MapInput } from '../../../../shared/src/map/mapVm';
import type { NextStepInput } from '../../../../shared/src/case/caseNextStep';

vi.mock('../../haptic', () => ({
  haptic: { tap: vi.fn(), select: vi.fn() },
}));

const TODAY = '2026-08-28';
const daysAgo = (n: number): string =>
  new Date(Date.parse(TODAY) - n * 86400000).toISOString().slice(0, 10);

const emptyMap: MapInput = {
  cases: [],
  notes: [],
  warmWords: [],
  ysqDone: false,
  today: TODAY,
};

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
    onClose: vi.fn(),
    onPickMode: vi.fn(),
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
    expect(document.body.textContent).not.toMatch(/0 случаев|0%|NaN/);
  });

  it('карта помечена черновиком — правило снять давление сделать сразу верно', () => {
    renderMap(emptyMap, emptyNext);
    expect(screen.getByText(/Черновик/)).toBeTruthy();
  });

  it('напоминает, что режимы — это части, а не человек целиком', () => {
    renderMap(emptyMap, emptyNext);
    expect(screen.getByText(/части, а не/)).toBeTruthy();
  });

  it('показывает разобранный режим его собственным именем', () => {
    renderMap(
      {
        ...emptyMap,
        cases: [
          { modeId: 'detached_protector', at: daysAgo(1) },
          { modeId: 'detached_protector', at: daysAgo(3) },
        ],
        notes: [
          { modeId: 'detached_protector', alias: 'Стена', hasCard: false },
        ],
      },
      {
        ...emptyNext,
        caseCount: 2,
        modeStats: [
          {
            modeId: 'detached_protector',
            alias: 'Стена',
            count: 2,
            hasCard: false,
            lastAt: daysAgo(1),
          },
        ],
        hasCopingMode: true,
      },
    );
    expect(screen.getByText('Стена')).toBeTruthy();
    // «2 случая» звучит и в строке режима, и в «Где я сейчас» — это разные
    // места одного факта, а не дубль.
    expect(screen.getAllByText(/2 случая/).length).toBeGreaterThan(0);
  });

  it('затихший режим показан с давностью, а не вычеркнут', () => {
    renderMap(
      {
        ...emptyMap,
        cases: [{ modeId: 'detached_protector', at: daysAgo(45) }],
        notes: [
          { modeId: 'detached_protector', alias: 'Стена', hasCard: true },
        ],
      },
      { ...emptyNext, caseCount: 1 },
    );
    expect(screen.getByText(/Не появлялся в записях 45/)).toBeTruthy();
  });

  it('«что дальше» — ровно одна кнопка', () => {
    renderMap(emptyMap, emptyNext);
    expect(
      screen.getAllByRole('button', { name: /Разобрать случай/ }),
    ).toHaveLength(1);
  });

  it('нажатие «что дальше» отдаёт наверх id шага', () => {
    const props = renderMap(emptyMap, emptyNext);
    fireEvent.click(screen.getByText(/Разобрать случай/));
    expect(props.onNextStep).toHaveBeenCalledTimes(1);
  });

  it('тап по режиму открывает его', () => {
    const props = renderMap(
      {
        ...emptyMap,
        cases: [{ modeId: 'detached_protector', at: daysAgo(1) }],
        notes: [
          { modeId: 'detached_protector', alias: 'Стена', hasCard: false },
        ],
      },
      { ...emptyNext, caseCount: 1 },
    );
    fireEvent.click(screen.getByText('Стена'));
    expect(props.onPickMode).toHaveBeenCalledWith('detached_protector');
  });

  it('полоса «откуда тянется» заперта до пяти разборов и объясняет почему', () => {
    renderMap(
      {
        ...emptyMap,
        cases: [{ modeId: 'detached_protector', at: daysAgo(1) }],
      },
      { ...emptyNext, caseCount: 1 },
    );
    expect(screen.getByText(/Откроется после пяти разборов/)).toBeTruthy();
  });
});
