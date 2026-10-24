// @vitest-environment jsdom
// Удаление практики — двухтапное подтверждение (аудит 2026-08, К3): один тап
// по маленькой (30×30) кнопке-крестику раньше стирал практику необратимо.
// Проверяем связку «первый тап показывает подтверждение → второй удаляет».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PracticesList } from './PracticesList';
import type { UserPractice } from '../api';

afterEach(() => cleanup());

const practices: UserPractice[] = [
  { id: 1, text: 'Пять глубоких вдохов', needId: 'safety' },
];

describe('PracticesList — удаление практики', () => {
  it('первый тап по кнопке удаления не вызывает onDelete, показывает «Точно удалить?»', () => {
    const onDelete = vi.fn();
    render(
      <PracticesList
        loadFailed={false}
        failedMessage=""
        practices={practices}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText('Удалить практику'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Точно удалить?')).toBeTruthy();
  });

  it('второй тап (на кнопке подтверждения) вызывает onDelete с id практики', () => {
    const onDelete = vi.fn();
    render(
      <PracticesList
        loadFailed={false}
        failedMessage=""
        practices={practices}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText('Удалить практику'));
    fireEvent.click(screen.getByText('Точно удалить?'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
