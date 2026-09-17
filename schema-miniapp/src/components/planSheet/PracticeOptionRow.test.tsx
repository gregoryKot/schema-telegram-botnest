// @vitest-environment jsdom
// PracticeOptionRow — строка варианта практики в плане. Проверяет: клик и
// клавиатура (Enter/Space, роль "button" на div — не нативная кнопка)
// вызывают onSelect; крестик удаления показан только для СВОИХ вариантов
// (isUser) с реальным id — чужой/встроенный вариант удалить нельзя.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PracticeOptionRow } from './PracticeOptionRow';

afterEach(() => {
  cleanup();
});

describe('PracticeOptionRow — выбор варианта', () => {
  it('клик по строке вызывает onSelect', () => {
    const onSelect = vi.fn();
    render(
      <PracticeOptionRow
        text="Дыхание 4-7-8"
        isUser={false}
        color="var(--accent)"
        onSelect={onSelect}
        deleting={false}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Дыхание 4-7-8'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('Enter на строке вызывает onSelect (доступность с клавиатуры)', () => {
    const onSelect = vi.fn();
    render(
      <PracticeOptionRow
        text="Дыхание 4-7-8"
        isUser={false}
        color="var(--accent)"
        onSelect={onSelect}
        deleting={false}
        onDelete={() => {}}
      />,
    );
    fireEvent.keyDown(screen.getByText('Дыхание 4-7-8'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('PracticeOptionRow — удаление своего варианта', () => {
  it('чужой вариант (isUser=false) — крестика удаления нет', () => {
    render(
      <PracticeOptionRow
        text="Готовая практика"
        isUser={false}
        id={5}
        color="var(--accent)"
        onSelect={() => {}}
        deleting={false}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByText('×')).toBeNull();
  });

  it('свой вариант без id (ещё не сохранён) — крестика удаления нет', () => {
    render(
      <PracticeOptionRow
        text="Мой вариант"
        isUser={true}
        color="var(--accent)"
        onSelect={() => {}}
        deleting={false}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByText('×')).toBeNull();
  });

  it('свой сохранённый вариант — клик по крестику вызывает onDelete', () => {
    const onDelete = vi.fn();
    render(
      <PracticeOptionRow
        text="Мой вариант"
        isUser={true}
        id={9}
        color="var(--accent)"
        onSelect={() => {}}
        deleting={false}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText('×'));
    expect(onDelete).toHaveBeenCalled();
  });
});
