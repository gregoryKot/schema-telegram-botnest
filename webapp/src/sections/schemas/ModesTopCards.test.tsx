// @vitest-environment jsdom
// Подсказка сверху вкладки «Режимы» (паритет с ModesHeroSection мини-аппа):
// знакомство для новичка, «Чаще всего включается», строка в дневник, пустота,
// скрытие блоком «Подсказка сверху», обращение ты/вы.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ModesTopCards } from './ModesTopCards';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';

afterEach(cleanup);

const blocks = (hidden: string[] = []) =>
  ({ isHidden: (id: string) => hidden.includes(id), hold: () => undefined, orderedIds: ['heroes', 'ysq_status'] }) as unknown as SiteScreenBlocks;
const summary = { id: 'vulnerable_child', days: 3, windowDays: 7 };

function setup(props: Partial<Parameters<typeof ModesTopCards>[0]> = {}, form: AddressForm = 'ty') {
  const fn = { onMeetCritic: vi.fn(), onOpenLibrary: vi.fn(), onPickManually: vi.fn(), onOpenMode: vi.fn() };
  const view = render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/schemas']}>
        <Routes>
          <Route path="/schemas" element={<ModesTopCards ready hasModes={false} summary={null} blocks={blocks()} {...fn} {...props} />} />
          <Route path="/diary" element={<p>экран дневника</p>} />
        </Routes>
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  return { ...fn, ...view };
}

describe('ModesTopCards', () => {
  it('новичок: знакомство с Критиком и два входа ведут куда надо', () => {
    const t = setup();
    expect(screen.getByText('Встретить своего Критика')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Начать знакомство →' }));
    expect(t.onMeetCritic).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Что такое режимы/ }));
    expect(t.onOpenLibrary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Отметить свои/ }));
    expect(t.onPickManually).toHaveBeenCalledTimes(1);
  });

  it('режимы есть и записи за неделю есть: «Чаще всего включается» открывает режим', () => {
    const t = setup({ hasModes: true, summary });
    fireEvent.click(screen.getByText('Чаще всего включается'));
    expect(t.onOpenMode).toHaveBeenCalledWith('vulnerable_child');
    expect(screen.queryByText('Встретить своего Критика')).toBeNull();
  });

  it('режимы есть, записей за неделю нет: строка ведёт в дневник', () => {
    setup({ hasModes: true });
    fireEvent.click(screen.getByRole('button', { name: /Картина недели появится из дневника/ }));
    expect(screen.getByText('экран дневника')).toBeTruthy();
  });

  it('пока грузится или режим из сводки неизвестен — пусто, ничего не выдумываем', () => {
    expect(setup({ ready: false }).container.innerHTML).toBe('');
    cleanup();
    expect(setup({ hasModes: true, summary: { ...summary, id: 'nope' } }).container.innerHTML).toBe('');
  });

  it('скрыт блоком «Подсказка сверху» — не рисуется ни в одном состоянии', () => {
    for (const p of [{}, { hasModes: true }, { hasModes: true, summary }]) {
      expect(setup({ ...p, blocks: blocks(['heroes']) }).container.innerHTML).toBe('');
      cleanup();
    }
  });

  it('форма «вы»: без «ты»-форм', () => {
    const t = setup({}, 'vy');
    expect(screen.getByText(/Начните с самого узнаваемого/)).toBeTruthy();
    expect(hasTyForms(t.container.textContent ?? '')).toBe(false);
  });
});
