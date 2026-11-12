// @vitest-environment jsdom
// Раскладка строки задания у терапевта (b31, «Задания» офлайн-клиента на 390): строка была flex без переноса с
// overflow-wrap: anywhere, и название шло колонкой шириной в букву, корзина и «Выполнено» уходили за край.
// jsdom раскладку не считает — сверяем то, что проверяемо: порядок и места детей строки, правила task-row.css
// (сетка узкого списка с местом каждому ребёнку, слово не рвётся посередине). Живая геометрия 320/390 —
// e2e-browser/therapy-smoke.spec.ts («терапевт, «Задания» на 320/390»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ClientTasksTab } from './ClientTasksTab';
import type { ClientDetail } from './clientSheetTypes';
import { readCss } from '../../styles/cssRules.test-helpers';

afterEach(cleanup);

const LONG = 'Каждый вечер перед сном записывать три ситуации, в которых включался Требовательный Критик';
const task = (id: number, over: Record<string, unknown> = {}) => ({
  id, userId: -5, assignedBy: 2, type: 'custom', text: LONG, targetDays: null, needId: null,
  dueDate: '2026-11-10', done: null, completedAt: null, createdAt: '2026-10-01T10:00:00Z', ...over,
});

function rows() {
  const detail = { clientTasks: [task(1), task(2, { done: true, completedAt: '2026-11-05T10:00:00Z' })], selectedClient: { telegramId: -5 } };
  const { container } = render(<ClientTasksTab detail={detail as unknown as ClientDetail} onAssign={vi.fn()} />);
  return [...container.querySelectorAll('.cp-task-list > .cp-task')];
}

const narrow = () => readCss('task-row.css').filter((r) => /@container cp-task-list \(max-width: 559px\)/.test(r.media));

describe('строка задания терапевта: раскладка', () => {
  it('дети строки — знак, тело (название, срок и статус), слот действий; ничего лишнего рядом с названием', () => {
    for (const row of rows()) {
      expect([...row.children].map((c) => c.className.split(' ')[0])).toEqual(['pp-row-art', 'cp-task-body', 'cp-task-acts']);
      const body = row.querySelector('.cp-task-body')!;
      expect(body.firstElementChild?.classList.contains('cp-task-title')).toBe(true);
      expect(body.querySelector('.pp-tag')).not.toBeNull(); // статус — под названием, а не в одной строке с ним
      expect(body.querySelector('button')).toBeNull(); // кнопки — только в слоте действий
    }
  });

  it('действия — в слоте: «Выполнено» (офлайн-клиент) и корзина 44; у выполненного — одна корзина', () => {
    const [open, done] = rows();
    const acts = (r: Element) => [...r.querySelector('.cp-task-acts')!.children].map((b) => b.textContent || b.getAttribute('aria-label'));
    expect(acts(open)).toEqual(['Выполнено', 'Удалить задание']);
    expect(acts(done)).toEqual(['Удалить задание']);
    expect(done.classList.contains('cp-task--done')).toBe(true);
  });

  it('узкий список (контейнер до 559px) — сетка: название во всю ширину справа от знака, срок под ним, действия ниже', () => {
    const rules = narrow();
    const body = (sel: string) => rules.find((r) => r.selectors.includes(sel))?.body;
    const grid = body('.ds-card.cp-task:has(> .cp-task-acts)');
    expect(grid).toMatch(/display:\s*grid/);
    expect(grid).toMatch(/grid-template-areas:\s*"art title title"\s*"\. meta meta"\s*"\. acts acts"/);
    // одна корзина — в строке срока справа, название по-прежнему во всю ширину
    expect(body('.ds-card.cp-task:has(> .cp-task-acts > :only-child)')).toMatch(/"art title title"\s*"\. meta acts"/);
    const p = '.cp-task:has(> .cp-task-acts) >';
    expect(body(`${p} .pp-row-art`)).toMatch(/grid-area:\s*art/);
    expect(body(`${p} .cp-task-body`)).toMatch(/display:\s*contents/);
    expect(body(`${p} .cp-task-body > .cp-task-title`)).toMatch(/grid-area:\s*title/);
    expect(body(`${p} .cp-task-body > :not(.cp-task-title)`)).toMatch(/grid-area:\s*meta/);
    expect(body(`${p} .cp-task-acts`)).toMatch(/grid-area:\s*acts/);
    expect(body(`${p} .cp-task-acts`)).toMatch(/flex-wrap:\s*wrap/);
  });

  it('у каждого ребёнка тела строки есть место в узкой сетке: название и одна строка срока со статусом', () => {
    for (const row of rows()) {
      const kids = [...row.querySelector('.cp-task-body')!.children];
      expect(kids).toHaveLength(2);
      expect(kids[1].classList.contains('tb-task-meta')).toBe(true);
    }
  });

  it('название рвётся только по слову: break-word в списке, anywhere у строки терапевта нет', () => {
    const list = readCss('task-row.css').find((r) => r.media === '' && r.selectors.includes('.cp-task-list .cp-task-title'));
    expect(list?.body).toMatch(/overflow-wrap:\s*break-word/);
    const own = readCss('therapist-tabs.css').filter((r) => r.selectors.some((s) => /tb-task/.test(s)));
    for (const r of own) expect(r.body).not.toMatch(/anywhere/);
    expect(readCss('task-row.css').find((r) => r.selectors.includes('.cp-task-list'))?.body).toMatch(/container:\s*cp-task-list/);
  });
});
