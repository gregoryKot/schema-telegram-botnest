// @vitest-environment jsdom
// ModeSelectStep — шаг 1 дневника режимов. Пустой modeId уже задет через
// ModeEntrySheet.test.tsx (правило №3: не дублируем этот путь). Здесь —
// непокрытая ветка: modeId уже выбран, экран показывает карточку режима
// с кнопкой «Сменить», клик по которой сбрасывает выбор (onChange('')).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeSelectStep } from './ModeSelectStep';

afterEach(cleanup);

describe('ModeSelectStep — режим уже выбран', () => {
  it('показывает карточку выбранного режима, а не чипы выбора', () => {
    render(<ModeSelectStep modeId="vulnerable_child" onChange={vi.fn()} />);
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Сменить')).toBeTruthy();
    expect(screen.queryByText(/Что с тобой сейчас/)).toBeNull();
  });

  it('клик по «Сменить» вызывает onChange с пустой строкой', () => {
    const onChange = vi.fn();
    render(<ModeSelectStep modeId="vulnerable_child" onChange={onChange} />);
    fireEvent.click(screen.getByText('Сменить'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
