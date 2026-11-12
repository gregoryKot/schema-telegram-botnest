// @vitest-environment jsdom
// Строка задания на телефоне до 559px (task-row.css). До b20 «Готово» у своего задания было кнопкой с текстом, и на
// телефоне её уводили под текст сеткой по именованным областям (ревью g4 r2: на 320 текст шёл столбиком в шесть строк;
// ревью g4 r6: полоса «от терапевта» без места в сетке вставала к правому краю). b20: «Готово» — круг 44 с галочкой
// в той же правой колонке, что шеврон и галочка «сделано сегодня», полосы нет («от терапевта» — в мете): строка
// остаётся рядом знак | текст | действие на любой ширине, сетка не нужна. Сверка идёт через шов: строки рендерит
// настоящий TaskRow во всех вариантах, совпадение селекторов — element.matches, CSS — исходники каскада строки
// (client-practice.css и task-row.css). Плотность строки (r7) — внизу файла.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { TaskRow } from '../sections/practice/TaskRow';
import type { UserTask } from '../api';
import { parseRules, readCss, type Rule } from './cssRules.test-helpers';

afterEach(cleanup);

const NARROW = (m: string) => /max-width:\s*559px/.test(m);
const cascade = (): Rule[] => [...readCss('task-row.css'), ...readCss('client-practice.css')].filter((r) => NARROW(r.media));

/** Специфичность селектора из классов и :has (каждый аргумент :has — классы): классы + максимум по аргументам :has. */
function spec(sel: string): number {
  let n = 0;
  const rest = sel.replace(/:has\(([^)]*)\)/g, (_, inner: string) => {
    n += Math.max(...inner.split(',').map((a) => (a.match(/\.[\w-]+/g) ?? []).length));
    return '';
  });
  return n + (rest.match(/\.[\w-]+/g) ?? []).length;
}

const task = (over: Partial<UserTask> = {}): UserTask =>
  ({ id: 1, type: 'custom', text: 'Заметить три момента', done: null, assignedBy: null, ...over }) as UserTask;
const noop = () => {};
/** Все варианты строки: с «Готово» (своё задание, от терапевта и без), сделанное сегодня, шеврон и ссылка. */
const VARIANTS: [string, ReactElement][] = [
  ['от терапевта + «Готово»', <TaskRow task={task({ assignedBy: 7 })} mark compact cta="начать →" onOpen={noop} onComplete={noop} />],
  ['своё + «Готово»', <TaskRow task={task()} compact cta="открыть →" onOpen={noop} onComplete={noop} />],
  ['сделано сегодня', <TaskRow task={task({ type: 'diary_streak', doneToday: true })} mark cta="открыть →" onOpen={noop} onComplete={noop} />],
  ['шеврон', <TaskRow task={task({ type: 'belief_check', assignedBy: 7 })} mark compact cta="начать →" onOpen={noop} />],
  ['ссылка', <TaskRow task={task({ type: 'belief_check' })} cta="начать →" onOpen={noop} />],
];
const CONTEXTS: [string, string][] = [['«Практики» (.cp-page--phone)', 'ds-page cp-page cp-page--phone'], ['«Задания», «Все задания»', 'sk-list']];

function rows(el: ReactElement, wrap: string): Element[] {
  const { container } = render(<div className={wrap}>{el}</div>);
  return [container.querySelector('.cp-task')!];
}

describe('строка задания до 559px: знак | текст | действие в один ряд', () => {
  const rules = cascade();

  it('варианты дают всех прямых детей TaskRow — сверка не пустая', () => {
    const keys = new Set(VARIANTS.flatMap(([, el]) => rows(el, 'sk-list').flatMap((r) => [...r.children].map((c) => c.classList[0]))));
    expect([...keys].sort()).toEqual(['cp-task-body', 'cp-task-check', 'cp-task-done', 'ds-chev', 'ds-link', 'pp-row-art'].sort());
    cleanup();
  });

  it.each(CONTEXTS)('%s: «Готово» — последний ребёнок ряда, сетка с кнопкой под текстом не действует', (_, wrap) => {
    for (const [name, el] of VARIANTS) {
      const [row] = rows(el, wrap);
      const btn = row.querySelector(':scope > .cp-task-done');
      if (btn) expect(row.lastElementChild, name).toBe(btn);
      const grid = rules.filter((r) => /display\s*:\s*grid/.test(r.body) && r.selectors.some((s) => row.matches(s)));
      expect(grid.map((r) => r.selectors.join(', ')), name).toEqual([]);
      cleanup();
    }
  });

  it('«Готово» — круг 44×44 (тап-цель), в своей колонке не сжимается', () => {
    const rule = readCss('task-row.css').find((r) => r.media === '' && r.selectors.includes('.cp-task-done'))!;
    expect(rule.body).toMatch(/width:\s*44px/);
    expect(rule.body).toMatch(/height:\s*44px/);
    expect(rule.body).toMatch(/flex:\s*none/);
  });

  it('контрольный образец: сетка r6 (кнопка под текстом) на строке с «Готово» — сверка краснеет', () => {
    const r6 = parseRules(`@media (max-width: 559px) {
      .ds-card.cp-task:has(> .cp-task-done) { display: grid; grid-template-areas: "art body" "art btn"; } }`);
    const [row] = rows(VARIANTS[1][1], 'sk-list');
    expect(r6.filter((r) => /display\s*:\s*grid/.test(r.body) && r.selectors.some((s) => row.matches(s)))).toHaveLength(1);
  });
});

// Плотность строки до 559px (ревью g4 r7): промежуток 12, поля 12/16, высота от 56 стояли под .cp-page--phone — только в
// «Практиках»; в «Заданиях» (/more) и «Все задания» та же строка шла свободнее (промежуток 16, поля .ds-card--row 16/20,
// высота от 44). Теперь плотность — правило на самой строке в task-row.css, рядом с сеткой.
const DENSE: [string, RegExp][] = [
  ['gap', /(?:^|;)\s*gap\s*:\s*var\(--space-12\)/],
  ['min-height', /min-height\s*:\s*56px/],
  ['padding', /padding\s*:\s*var\(--space-12\)\s+var\(--space-16\)/],
];
/** Чего из плотности нет у строки: среди правил, чей селектор подходит к строке и сильнее .ds-card--row (один класс). */
function densityMissing(rules: Rule[], row: Element): string[] {
  const mine = rules.flatMap((r) => r.selectors.map((s) => ({ s, body: r.body }))).filter((x) => spec(x.s) > 1 && row.matches(x.s));
  return DENSE.filter(([, re]) => !mine.some((x) => re.test(x.body))).map(([name]) => name);
}

describe('строка задания до 559px: плотность одна на всех экранах', () => {
  const rules = cascade();

  it.each(CONTEXTS)('%s: промежуток 12, поля 12/16, высота от 56', (_, wrap) => {
    for (const [name, el] of VARIANTS) {
      for (const row of rows(el, wrap)) expect(densityMissing(rules, row), name).toEqual([]);
      cleanup();
    }
  });

  it('плотность не дублируется под .cp-page--phone в client-practice.css', () => {
    const scoped = readCss('client-practice.css').filter((r) => r.selectors.some((s) => s.includes('.cp-page--phone') && /\.cp-task(?![\w-])/.test(s)));
    expect(scoped.map((r) => r.selectors.join(', '))).toEqual([]);
  });

  it('контрольный образец: плотность r6 под .cp-page--phone — в «Практиках» есть, в «Заданиях» нет', () => {
    const r6 = parseRules('.cp-page--phone .cp-task { gap: var(--space-12); min-height: 56px; padding: var(--space-12) var(--space-16); }');
    const [inPractice] = rows(VARIANTS[1][1], 'ds-page cp-page cp-page--phone');
    expect(densityMissing(r6, inPractice)).toEqual([]);
    cleanup();
    const [inTasks] = rows(VARIANTS[1][1], 'sk-list');
    expect(densityMissing(r6, inTasks)).toEqual(['gap', 'min-height', 'padding']);
  });
});
