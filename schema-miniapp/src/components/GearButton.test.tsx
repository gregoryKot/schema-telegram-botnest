// @vitest-environment jsdom
// GearButton — единая кнопка-шестерёнка «настроить экран» (44×44, тот же
// стиль на «Сегодня», «Паттернах» и «Здесь и сейчас», правило «одна
// механика — один компонент»). Проверяем то, что от неё реально зависит:
// клик и aria-label из пропса — вёрстку 44×44 держит сама разметка.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GearButton } from './GearButton';

afterEach(() => {
  cleanup();
});

describe('GearButton', () => {
  it('рендерит aria-label из пропса', () => {
    render(<GearButton onClick={() => {}} ariaLabel="Настроить экран" />);
    expect(screen.getByLabelText('Настроить экран')).toBeTruthy();
  });

  it('клик вызывает onClick', () => {
    const onClick = vi.fn();
    render(<GearButton onClick={onClick} ariaLabel="Настроить экран" />);
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('разные экраны получают разный aria-label — не путаются между собой', () => {
    render(<GearButton onClick={() => {}} ariaLabel="Настроить инструменты" />);
    expect(screen.getByLabelText('Настроить инструменты')).toBeTruthy();
    expect(screen.queryByLabelText('Настроить экран')).toBeNull();
  });
});
