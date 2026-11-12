// @vitest-environment jsdom
// Правило №4, r2: плитка шаблона и задание, которое она создаст, — один знак. До r2 плитка «Дневник режима» рисовала
// Cluster (вид сущности «дневник режима»), а созданное ею «Своё задание» в строке и на доске — Check (TaskSign).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AssignTemplateTiles } from './AssignTemplateTiles';
import { ASSIGN_TEMPLATES } from './assignTemplates';
import { TaskSign } from '../../sections/practice/TaskSign';

afterEach(cleanup);

describe('AssignTemplateTiles: знак плитки = знак TaskSign её задания', () => {
  it('каждая плитка рисует тот же знак, что строка задания с её типом и заготовкой текста', () => {
    const { container } = render(<AssignTemplateTiles onAssign={vi.fn()} />);
    const tiles = [...container.querySelectorAll('.tb-tpl')];
    expect(tiles).toHaveLength(ASSIGN_TEMPLATES.length);
    ASSIGN_TEMPLATES.forEach((t, i) => {
      const tileArt = tiles[i].querySelector('.tb-tpl-art')!.innerHTML;
      const { container: row } = render(<TaskSign task={{ type: t.preset.type, text: t.preset.text ?? '' }} />);
      expect(tileArt, t.title).toBe(row.innerHTML);
      expect(tileArt).not.toBe('');
    });
  });

  it('плитка «Схема-карточка» не совпадает знаком с «Дневником режима» (знаки различают тип)', () => {
    const { container } = render(<AssignTemplateTiles onAssign={vi.fn()} />);
    const arts = [...container.querySelectorAll('.tb-tpl-art')].map((a) => a.innerHTML);
    expect(new Set(arts).size).toBe(arts.length);
  });
});
