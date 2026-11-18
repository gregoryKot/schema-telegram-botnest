// @vitest-environment jsdom
// Состояние маршрута из общего поиска → лист «Новое задание» с пунктом каталога и форма нового клиента.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import type { TherapyClientSummary } from '../../api';
import { ADD_CLIENT_STATE, assignTaskState, assignTaskTarget, useCabinetRouteActions } from './cabinetRouteActions';

const TASK: CatalogTask = {
  id: 'pismo', title: 'Письмо Критику', why: '', group: 'modes',
  variants: [{ text: 'Написать и не отправлять', forModes: [], forSchemas: [] }, { text: 'Другой текст', forModes: [], forSchemas: [] }],
};
const PRESET = { type: 'custom', text: 'Письмо Критику\nНаписать и не отправлять', catalogId: 'pismo' };
const CLIENT = { telegramId: 7, urlCode: 'abcdefgh' } as TherapyClientSummary;

afterEach(cleanup);

describe('assignTaskState / assignTaskTarget', () => {
  it('пункт каталога — «Своё задание» с названием и основным текстом; без пункта — пустой лист', () => {
    expect(assignTaskState(TASK)).toEqual({ assignTask: { preset: PRESET } });
    expect(assignTaskTarget(assignTaskState(TASK))).toEqual({ preset: PRESET });
    expect(assignTaskTarget(assignTaskState(null))).toEqual({});
  });

  it('чужое состояние — не цель; битый пункт — лист без пункта', () => {
    for (const state of [null, undefined, {}, { guideSheet: { kind: 'mode', id: 'x' } }, { assignTask: 'да' }]) {
      expect(assignTaskTarget(state)).toBeNull();
    }
    expect(assignTaskTarget({ assignTask: { preset: { type: 'custom', text: 5 } } })).toEqual({});
  });
});

describe('useCabinetRouteActions', () => {
  const setup = (state: unknown, selectedClient: TherapyClientSummary | null) => {
    const setShowAssign = vi.fn();
    const setOpen = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) =>
      <MemoryRouter initialEntries={[{ pathname: '/cabinet/abcdefgh/tasks', state }]}>{children}</MemoryRouter>;
    const hook = renderHook(
      ({ selected }: { selected: TherapyClientSummary | null }) =>
        useCabinetRouteActions({ detail: { selectedClient: selected, setShowAssign }, openClientRef: 'abcdefgh', addClient: { setOpen } }),
      { wrapper, initialProps: { selected: selectedClient } },
    );
    return { hook, setShowAssign, setOpen };
  };

  it('карточка открыта — лист открывается с пунктом каталога, один раз', () => {
    const { hook, setShowAssign } = setup(assignTaskState(TASK), CLIENT);
    expect(setShowAssign).toHaveBeenCalledTimes(1);
    expect(setShowAssign).toHaveBeenCalledWith(true);
    expect(hook.result.current.assignPreset).toEqual(PRESET);
    hook.rerender({ selected: CLIENT });
    expect(setShowAssign).toHaveBeenCalledTimes(1);
  });

  it('клиент ещё не выбран (список грузится) — лист ждёт карточку', () => {
    const { hook, setShowAssign } = setup(assignTaskState(null), null);
    expect(setShowAssign).not.toHaveBeenCalled();
    hook.rerender({ selected: { ...CLIENT, urlCode: 'zzzzzzzz' } });
    expect(setShowAssign).not.toHaveBeenCalled();
    hook.rerender({ selected: CLIENT });
    expect(setShowAssign).toHaveBeenCalledWith(true);
    expect(hook.result.current.assignPreset).toBeUndefined();
  });

  it('{ addClient } открывает форму клиента; без состояния ничего не открывается', () => {
    const add = setup(ADD_CLIENT_STATE, null);
    expect(add.setOpen).toHaveBeenCalledWith(true);
    expect(add.setShowAssign).not.toHaveBeenCalled();
    const none = setup(null, CLIENT);
    expect(none.setOpen).not.toHaveBeenCalled();
    expect(none.setShowAssign).not.toHaveBeenCalled();
  });
});
