// @vitest-environment jsdom
// JourneyDeleteButton: не рендерится для недоступных типов, требует два
// тапа (первый — только подтверждение, действие не вызывается), busy
// блокирует кнопку, ошибка показывает role="alert". Тап-зона ≥44px
// (правило CLAUDE.md «Онбординг и очевидность» / хитбокс).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JourneyDeleteButton } from './JourneyDeleteButton';
import type { JourneyDeleteState } from './journeyDelete';
import type { JourneyItem } from './journeyMeta';

afterEach(cleanup);

const tr = (ty: string) => ty;

function makeDel(
  overrides: Partial<JourneyDeleteState> = {},
): JourneyDeleteState {
  return {
    busy: false,
    failed: false,
    remove: vi.fn(),
    ...overrides,
  };
}

describe('JourneyDeleteButton', () => {
  it('не рендерится для типа, недоступного для удаления', () => {
    const item: JourneyItem = { type: 'gratitude', at: '2026-07-20', id: 1 };
    const { container } = render(
      <JourneyDeleteButton tr={tr} item={item} del={makeDel()} />,
    );
    expect(container.textContent).toBe('');
  });

  it('первый тап переводит кнопку в состояние подтверждения, remove не вызывается', () => {
    const remove = vi.fn();
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    render(
      <JourneyDeleteButton tr={tr} item={item} del={makeDel({ remove })} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText(/Точно удалить/)).not.toBeNull();
  });

  it('второй тап в окне подтверждения вызывает remove с item', () => {
    const remove = vi.fn();
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    render(
      <JourneyDeleteButton tr={tr} item={item} del={makeDel({ remove })} />,
    );
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(item);
  });

  it('busy — кнопка выключена и показывает статус', () => {
    const item: JourneyItem = { type: 'flashcard', at: '2026-07-20', id: 2 };
    render(
      <JourneyDeleteButton tr={tr} item={item} del={makeDel({ busy: true })} />,
    );
    const btn = screen.getByRole('button');
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('Удаляю…')).not.toBeNull();
  });

  it('failed — показывает role="alert" с текстом ошибки', () => {
    const item: JourneyItem = { type: 'flashcard', at: '2026-07-20', id: 2 };
    render(
      <JourneyDeleteButton
        tr={tr}
        item={item}
        del={makeDel({ failed: true })}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'Не получилось удалить',
    );
  });

  // Вид — в webapp/src/styles/journey.css (тихая ссылка под «Поделиться карточкой», b22-journey).
  const css = () =>
    readFileSync(
      join(__dirname, '../../../webapp/src/styles/journey.css'),
      'utf8',
    );
  const rule = (sel: string) =>
    css().match(
      new RegExp(`${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`),
    )?.[1] ?? '';

  it('тап-зона кнопки не меньше 44px (правило хитбокса)', () => {
    const item: JourneyItem = { type: 'belief_check', at: '2026-07-20', id: 9 };
    render(<JourneyDeleteButton tr={tr} item={item} del={makeDel()} />);
    expect(screen.getByRole('button').className).toContain('jr-delete-btn');
    const minHeight = parseFloat(
      rule('.ds-link.jr-delete-btn').match(/min-height:\s*(\d+)px/)?.[1] ?? '0',
    );
    expect(minHeight).toBeGreaterThanOrEqual(44);
  });

  // Свип цвета #516 прошёл мимо четырёх rgba(255,100,100,…) здесь: цвет «опасно»
  // жил литералом и не следовал теме. Теперь — токен --accent-red у подтверждения и ошибки.
  it('цвет «удалить» — из токена --accent-red, а не литералом', () => {
    const src = readFileSync(
      join(__dirname, 'JourneyDeleteButton.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/rgba?\(\s*\d|#[0-9a-f]{3,8}\b/i);
    expect(rule('.ds-link.jr-delete-btn.is-pending')).toMatch(
      /color: var\(--accent-red\)/,
    );
    expect(rule('.jr-delete-err')).toMatch(/color: var\(--accent-red\)/);
  });

  it('подтверждение («Точно удалить?») — красным словом, первый тап — тихим', () => {
    const item: JourneyItem = { type: 'belief_check', at: '2026-07-20', id: 9 };
    render(<JourneyDeleteButton tr={tr} item={item} del={makeDel()} />);
    const btn = screen.getByRole('button');
    expect(btn.className).not.toContain('is-pending');
    fireEvent.click(btn);
    expect(screen.getByRole('button').className).toContain('is-pending');
  });
});
