// @vitest-environment jsdom
// ModeGroupList — полный список режимов по группам (0% покрытия), третичный
// путь выбора режима вручную. Проверяем: рендер названий групп, клик по
// режиму зовёт onChange(id) с верным id (а не с именем/индексом — типичная
// ошибка при копипасте между списками).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeGroupList } from './ModeGroupList';

afterEach(cleanup);

describe('ModeGroupList', () => {
  it('рендерит заголовок хотя бы одной группы («Детские режимы»)', () => {
    render(<ModeGroupList onChange={() => {}} />);
    expect(screen.getByText('Детские режимы')).toBeTruthy();
  });

  it('клик по конкретному режиму зовёт onChange с его id', () => {
    const onChange = vi.fn();
    render(<ModeGroupList onChange={onChange} />);
    fireEvent.click(screen.getByText(/Уязвимый Ребёнок/));
    expect(onChange).toHaveBeenCalledWith('vulnerable_child');
  });
});
