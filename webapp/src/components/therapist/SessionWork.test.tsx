// @vitest-environment jsdom
// «Что делали» в итогах сессии (#1330): добавить пункт → сохранить → пункт под записью.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { useNoteComposer } from '../../../../shared/src/therapy/useNoteComposer';
import type { TherapistNote } from '../../../../shared/src/apiTypes';
import type { UserId } from '../../../../shared/src/userId';
import type { SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';
import { ClientSessionsTab } from './ClientSessionsTab';
import { makeClientDetail } from './clientDetail.test-helpers';

const listCustomModes = vi.fn(async () => [{ id: 5, name: 'Тихий Наблюдатель' }]);
vi.mock('../../api', async (orig) => {
  const real = await orig<typeof import('../../api')>();
  return { ...real, api: { ...real.api, listCustomModes: () => listCustomModes() } };
});

const create = vi.fn(async (clientId: UserId, date: string, text: string, work: SessionWorkItem[]): Promise<TherapistNote> =>
  ({ id: 9, therapistId: 1, clientId, date, text, work, createdAt: '2026-11-17T10:00:00Z' }));
const onWorkSaved = vi.fn();

function Tab({ modeIds = ['vulnerable_child'] }: { modeIds?: string[] }) {
  const ref = useRef<UserId | null>(7);
  const notes = useNoteComposer(ref, { create, remove: vi.fn(), onWorkSaved });
  return <ClientSessionsTab detail={makeClientDetail({ ...notes, activeModeIds: modeIds })} />;
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => { create.mockClear(); onWorkSaved.mockClear(); listCustomModes.mockClear(); });

describe('«Что делали» в форме итогов', () => {
  it('пустое состояние — одна строка-кнопка; выбор вида тремя группами', () => {
    render(<Tab />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Сохранить' }).disabled).toBe(true);
    click('Что делали на сессии — добавить');
    const picker = screen.getByRole('group', { name: 'Что делали: выбор' });
    expect(within(within(picker).getByRole('group', { name: 'Техники' })).getAllByRole('button')).toHaveLength(56);
    expect(within(within(picker).getByRole('group', { name: 'Упражнения' })).getAllByRole('button')).toHaveLength(8);
    expect(within(within(picker).getByRole('group', { name: 'Своё' })).getAllByRole('button')).toHaveLength(1);
  });

  it('пункт с режимом и полем сохраняется без текста и встаёт под записью', async () => {
    render(<Tab />);
    click('Что делали на сессии — добавить');
    click('Рескриптинг в воображении');
    const item = screen.getByRole('group', { name: 'Рескриптинг в воображении' });
    // Режимы: сначала только режим клиента, остальные — под «Все».
    fireEvent.click(within(item).getByRole('button', { name: /Режимы/ }));
    expect(within(item).queryByRole('button', { name: /Карающий Критик/ })).toBeNull();
    fireEvent.click(within(item).getByRole('button', { name: /Уязвимый Ребёнок/ }));
    fireEvent.click(within(item).getByRole('button', { name: 'Все' }));
    expect(within(item).getByRole('button', { name: /Карающий Критик/ })).toBeTruthy();
    fireEvent.change(within(item).getByLabelText('Ситуация-триггер'), { target: { value: ' ссора с матерью ' } });
    fireEvent.change(within(item).getByLabelText('Чем закончилось'), { target: { value: '   ' } });

    await act(async () => { click('Сохранить'); });
    const work = create.mock.calls[0][3];
    expect(create.mock.calls[0][2]).toBe('');
    expect(work).toEqual([expect.objectContaining({
      kind: 'technique', refId: 'imagery_rescripting', modeIds: ['vulnerable_child'], fields: { trigger: 'ссора с матерью' },
    })]);
    expect(onWorkSaved).toHaveBeenCalledWith(work);

    // Форма очищена, пункт — под записью в архиве.
    expect(screen.queryByRole('group', { name: 'Рескриптинг в воображении' })).toBeNull();
    const done = within(screen.getByRole('list', { name: 'Что делали' }));
    expect(done.getByText('Рескриптинг в воображении')).toBeTruthy();
    expect(done.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(done.getByText('Ситуация-триггер')).toBeTruthy();
    expect(done.getByText('ссора с матерью')).toBeTruthy();
    expect(done.queryByText('Чем закончилось')).toBeNull();
  });

  it('несколько пунктов, «Своё» с названием, удаление пункта', async () => {
    render(<Tab modeIds={[]} />);
    click('Что делали на сессии — добавить');
    click('Своё');
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Песочница' } });
    click('Добавить ещё');
    click('Безопасное место');
    click('Убрать пункт «Безопасное место»');
    expect(screen.queryByRole('group', { name: 'Безопасное место' })).toBeNull();
    await act(async () => { click('Сохранить'); });
    expect(create.mock.calls[0][3]).toEqual([expect.objectContaining({ kind: 'custom', customName: 'Песочница' })]);
    expect(within(screen.getByRole('list', { name: 'Что делали' })).getByText('Песочница')).toBeTruthy();
  });

  it('запись без пунктов выглядит как раньше; событие не шлётся', async () => {
    render(<Tab />);
    fireEvent.change(screen.getByPlaceholderText(/Наблюдения/), { target: { value: 'текст' } });
    await act(async () => { click('Сохранить'); });
    expect(create.mock.calls[0][3]).toEqual([]);
    expect(onWorkSaved).not.toHaveBeenCalled();
    expect(screen.getByText('текст')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Что делали' })).toBeNull();
  });

  it('свой режим терапевта: под «Все» отдельной группой, после сохранения — метка под записью', async () => {
    render(<Tab />);
    expect(listCustomModes).not.toHaveBeenCalled(); // пока пунктов нет, свои режимы не грузятся
    click('Что делали на сессии — добавить');
    click('Работа со стульями');
    const item = screen.getByRole('group', { name: 'Работа со стульями' });
    fireEvent.click(within(item).getByRole('button', { name: /Режимы/ }));
    await act(async () => {});
    expect(within(item).queryByRole('button', { name: /Тихий Наблюдатель/ })).toBeNull(); // короткий список — только режимы клиента
    fireEvent.click(within(item).getByRole('button', { name: 'Все' }));
    fireEvent.click(within(item).getByRole('button', { name: /Тихий Наблюдатель/ }));
    expect(within(item).getByRole('button', { name: /Режимы/ }).textContent).toContain('Тихий Наблюдатель');
    await act(async () => { click('Сохранить'); });
    expect(create.mock.calls[0][3]).toEqual([expect.objectContaining({ modeIds: ['cm_5'] })]);
    expect(within(screen.getByRole('list', { name: 'Что делали' })).getByText('Тихий Наблюдатель')).toBeTruthy();
  });
});
