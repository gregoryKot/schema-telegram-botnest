// @vitest-environment jsdom
// Правило №4, r2: плитка шаблона и задание, которое она создаст, — один знак. Исключение — «Дневник режима»:
// его «Своё задание» рисует галочку, а галочка на плитке читается как «выполнено», поэтому плитка несёт знак режимов.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AssignTemplateTiles } from './AssignTemplateTiles';
import { ASSIGN_TEMPLATES } from './assignTemplates';
import { TaskSign } from '../../sections/practice/TaskSign';
import { SignArt } from '../art/SignArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

const MODE_DIARY = 'Дневник режима';

afterEach(cleanup);

describe('AssignTemplateTiles: знак плитки = знак TaskSign её задания', () => {
  it('каждая плитка рисует тот же знак, что строка задания с её типом и заготовкой текста', () => {
    const { container } = render(<AssignTemplateTiles onAssign={vi.fn()} />);
    const tiles = [...container.querySelectorAll('.tb-tpl')];
    expect(tiles).toHaveLength(ASSIGN_TEMPLATES.length);
    ASSIGN_TEMPLATES.forEach((t, i) => {
      if (t.title === MODE_DIARY) return;
      const tileArt = tiles[i].querySelector('.tb-tpl-art')!.innerHTML;
      const { container: row } = render(<TaskSign task={{ type: t.preset.type, text: t.preset.text ?? '' }} />);
      expect(tileArt, t.title).toBe(row.innerHTML);
      expect(tileArt).not.toBe('');
    });
  });

  it('плитка «Дневник режима» рисует знак режимов, а не галочку «выполнено»', () => {
    const { container } = render(<AssignTemplateTiles onAssign={vi.fn()} />);
    const i = ASSIGN_TEMPLATES.findIndex((t) => t.title === MODE_DIARY);
    const tileArt = container.querySelectorAll('.tb-tpl-art')[i].innerHTML;
    const { container: modes } = render(<SignArt sign={ENTITY_LOOK.modes.sign} size="row" />);
    const { container: check } = render(<SignArt sign="check" size="row" />);
    expect(tileArt).toBe(modes.innerHTML);
    expect(tileArt).not.toBe(check.innerHTML);
  });

  it('плитка «Схема-карточка» не совпадает знаком с «Дневником режима» (знаки различают тип)', () => {
    const { container } = render(<AssignTemplateTiles onAssign={vi.fn()} />);
    const arts = [...container.querySelectorAll('.tb-tpl-art')].map((a) => a.innerHTML);
    expect(new Set(arts).size).toBe(arts.length);
  });
});
