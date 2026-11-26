// @vitest-environment jsdom
// «Мои режимы» в палитре карты: отказ сохранить или удалить свой режим виден
// терапевту. До 2026-11 промис шёл без catch (нашёл no-floating-promises, когда
// правило включили в webapp): форма просто не закрывалась, режим молча не
// появлялся или не исчезал.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { TherapistCustomMode } from '../../api';
import { CustomModesPalette } from './CustomModesPalette';
import type { CustomModesState } from './useCustomModes';

const createCustomMode = vi.fn();
const deleteCustomMode = vi.fn();
vi.mock('../../api', () => ({
  api: {
    createCustomMode: (...a: unknown[]) => createCustomMode(...a),
    deleteCustomMode: (...a: unknown[]) => deleteCustomMode(...a),
  },
}));

const mode = (id: number, name: string): TherapistCustomMode => ({ id, therapistId: 7, name, emoji: '⬡', nodeType: 'custom', createdAt: '2026-11-01' });

function Harness({ initial }: { initial: CustomModesState }) {
  const [state, setState] = useState<CustomModesState>(initial);
  return <CustomModesPalette state={state} setState={setState} onAdd={vi.fn()} />;
}

async function typeAndSave(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Добавить свой режим' }));
  fireEvent.change(screen.getByPlaceholderText('Название…'), { target: { value: name } });
  await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('CustomModesPalette — сохранение своего режима', () => {
  it('сервер принял — режим в списке, форма закрыта, ошибки нет', async () => {
    createCustomMode.mockResolvedValue(mode(1, 'Обиженный'));
    render(<Harness initial={[]} />);
    await typeAndSave('Обиженный');
    expect(screen.getByText('Обиженный')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Название…')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('сервер отказал — «Не получилось сохранить», форма открыта с введённым названием', async () => {
    createCustomMode.mockRejectedValue(new Error('500'));
    render(<Harness initial={[]} />);
    await typeAndSave('Обиженный');
    expect(screen.getByRole('alert').textContent).toContain('Не получилось сохранить режим');
    expect(screen.getByDisplayValue('Обиженный')).toBeTruthy();
  });

  it('Enter в поле идёт тем же путём: отказ виден', async () => {
    createCustomMode.mockRejectedValue(new Error('500'));
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить свой режим' }));
    const input = screen.getByPlaceholderText('Название…');
    fireEvent.change(input, { target: { value: 'Обиженный' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(screen.getByRole('alert').textContent).toContain('Не получилось сохранить режим');
  });
});

describe('CustomModesPalette — удаление своего режима', () => {
  it('сервер отказал — режим остаётся в списке, «Не получилось удалить» на экране', async () => {
    deleteCustomMode.mockRejectedValue(new Error('500'));
    render(<Harness initial={[mode(1, 'Обиженный')]} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Удалить' })); });
    expect(screen.getByRole('alert').textContent).toContain('Не получилось удалить режим');
    expect(screen.getByText('Обиженный')).toBeTruthy();
  });

  it('сервер принял — режим уходит из списка', async () => {
    deleteCustomMode.mockResolvedValue(undefined);
    render(<Harness initial={[mode(1, 'Обиженный')]} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Удалить' })); });
    expect(screen.queryByText('Обиженный')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
