// @vitest-environment jsdom
// SharePillButton — примитив компактной кнопки «Поделиться», общий для
// PhraseShareCard/DiaryShareButton/MonthShareButton (правило «одна механика
// — один компонент»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SharePillButton } from './SharePillButton';

afterEach(cleanup);

describe('SharePillButton', () => {
  it('рендерит доступную кнопку с переданным label и зовёт onClick', () => {
    const onClick = vi.fn();
    render(<SharePillButton onClick={onClick} label="Поделиться месяцем" />);
    fireEvent.click(screen.getByLabelText('Поделиться месяцем'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
