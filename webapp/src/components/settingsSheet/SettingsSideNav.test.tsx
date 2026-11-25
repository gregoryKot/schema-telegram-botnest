// @vitest-environment jsdom
// Оглавление листа «Настройки»: у раздела под линией чтения — черта акцента (aria-current), без плашек.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { SettingsSideNav } from './SettingsSideNav';
import { activeSectionId } from './activeSection';

afterEach(cleanup);

describe('activeSectionId — какой раздел сейчас читают', () => {
  const heads = [{ id: 'a', top: -300 }, { id: 'b', top: 16 }, { id: 'c', top: 200 }];
  it('последний раздел, чей заголовок поднялся до линии', () => {
    expect(activeSectionId(heads, 48)).toBe('b');
  });
  it('пункт оглавления положил заголовок на 16px — активен он, а не короткий следующий ниже линии', () => {
    expect(activeSectionId([{ id: 'x', top: 16 }, { id: 'y', top: 120 }], 48)).toBe('x');
  });
  it('в начале листа (заголовки ниже линии) — первый; пусто — null', () => {
    expect(activeSectionId([{ id: 'a', top: 80 }, { id: 'b', top: 400 }], 48)).toBe('a');
    expect(activeSectionId([], 48)).toBeNull();
  });
});

describe('SettingsSideNav', () => {
  const items = [{ id: 's-a', label: 'Имя', find: '' }, { id: 's-b', label: 'Данные', find: '' }];
  it('до прокрутки отмечен первый раздел; нажатие зовёт прокрутку к разделу', () => {
    const onPick = vi.fn();
    render(<SettingsSideNav items={items} onPick={onPick} scrollRef={createRef<HTMLElement>()} />);
    expect(screen.getByRole('button', { name: 'Имя' }).getAttribute('aria-current')).toBe('location');
    expect(screen.getByRole('button', { name: 'Данные' }).getAttribute('aria-current')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Данные' }));
    expect(onPick).toHaveBeenCalledWith('s-b');
  });
});
