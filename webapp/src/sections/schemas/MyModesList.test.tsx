// @vitest-environment jsdom
// «Мои режимы» на телефоне: строки по группам, статус карточки, частота, пустое состояние и «+ Добавить режим».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { MyModesList } from './MyModesList';

afterEach(cleanup);

const child = MODE_GROUPS.find(g => g.id === 'child')!;
const critic = MODE_GROUPS.find(g => g.id === 'critic')!;
const [c1] = child.items;
const [k1] = critic.items;

describe('MyModesList', () => {
  const base = { loading: false, onAdd: vi.fn(), onOpenMode: vi.fn() };
  it('режимы сгруппированы по группам, видны статус и частота; тап открывает режим', () => {
    const open = vi.fn();
    render(<MyModesList {...base} onOpenMode={open} ids={[k1.id, c1.id]} statusFor={() => 'карточка пока пустая'} freq={{ [c1.id]: 2 }} />);
    expect(screen.getByText(child.group)).toBeTruthy();
    expect(screen.getByText(critic.group)).toBeTruthy();
    expect(screen.getAllByText('карточка пока пустая')).toHaveLength(2);
    expect(screen.getByText('2 дня')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(c1.name) }));
    expect(open).toHaveBeenCalledWith(c1.id);
  });
  it('пока статус не загрузился, «карточка пока пустая» не выдумывается', () => {
    render(<MyModesList {...base} ids={[c1.id]} />);
    expect(screen.queryByText('карточка пока пустая')).toBeNull();
  });
  it('нет режимов: подсказка и «+ Добавить режим», групп нет', () => {
    const add = vi.fn();
    render(<MyModesList {...base} onAdd={add} ids={[]} />);
    expect(screen.getByText(/Добавь режимы/)).toBeTruthy();
    expect(screen.queryByText(child.group)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Добавить режим' }));
    expect(add).toHaveBeenCalledTimes(1);
  });
  it('пока грузится: скелетон вместо списка и подсказки', () => {
    render(<MyModesList {...base} loading ids={[]} />);
    expect(screen.queryByRole('button', { name: '+ Добавить режим' })).toBeNull();
    expect(screen.queryByText(/Добавь режимы/)).toBeNull();
  });
});
