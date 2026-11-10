// @vitest-environment jsdom
// Строка задания на телефоне до 559px (task-row.css): у строки с «Готово» сетка — кнопка под текстом. Ревью g4 r6:
// сетка ставила явно только знак, текст, кнопку и шеврон, а полоса «от терапевта» вставала в первую свободную
// ячейку — к ПРАВОМУ краю карточки (в «Все цели» у задания терапевта с «Готово»). Сверка идёт через шов: строки
// рендерит настоящий TaskRow во всех вариантах, совпадение селекторов — element.matches (jsdom понимает :has), CSS —
// исходники каскада строки (client-practice.css и task-row.css). Каждый прямой ребёнок строки с «Готово» обязан
// иметь своё место (grid-area из шаблона, который действует на эту строку, или явный grid-column). Строка та же
// вне «Практик» («Задания» в /more, «Все задания» с «Сегодня»): сетка не зависит от .cp-page--phone. Живая
// раскладка 320/360/390 — зонд стенда r6-task-grid (левый край полосы левее знака). Плотность строки (r7) — внизу файла.
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

const areasOf = (body: string): Set<string> | null => {
  const m = /grid-template-areas\s*:\s*([^;]+)/.exec(body);
  return m ? new Set(m[1].replace(/"/g, ' ').split(/\s+/).filter((a) => a && a !== '.')) : null;
};

/** Что не так с размещением детей строки в узкой сетке; [] — сетка не действует или каждому ребёнку есть место. */
function gridProblems(rules: Rule[], row: Element): string[] {
  const hit = (pred: (body: string) => boolean) => rules
    .flatMap((r, i) => r.selectors.map((s) => ({ s, body: r.body, i })))
    .filter((x) => pred(x.body) && row.matches(x.s))
    .sort((a, b) => spec(a.s) - spec(b.s) || a.i - b.i);
  if (!hit((b) => /display\s*:\s*grid/.test(b)).length) return [];
  const tpl = hit((b) => areasOf(b) !== null).pop();
  const areas = tpl ? areasOf(tpl.body)! : new Set<string>();
  return [...row.children].flatMap((child) => {
    const key = child.classList[0];
    const place = rules.flatMap((r) => r.selectors.map((s) => ({ s, body: r.body })))
      .filter((x) => /grid-(area|column)\s*:/.test(x.body) && child.matches(x.s)).pop();
    if (!place) return [`${key}: нет места в сетке`];
    const area = /grid-area\s*:\s*([\w-]+)/.exec(place.body)?.[1];
    return area && !areas.has(area) ? [`${key}: области «${area}» нет в шаблоне строки`] : [];
  });
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

/** Ряд как есть и «что если» — та же строка с «Готово»: у каждого ребёнка любого варианта есть место. */
function rows(el: ReactElement, wrap: string): Element[] {
  const { container } = render(<div className={wrap}>{el}</div>);
  const row = container.querySelector('.cp-task')!;
  if (row.querySelector(':scope > .ds-btn')) return [row];
  const withBtn = row.cloneNode(true) as Element;
  const btn = document.createElement('button');
  btn.className = 'ds-btn ds-btn--sm';
  withBtn.insertBefore(btn, withBtn.querySelector(':scope > .ds-chev, :scope > .ds-link'));
  row.parentElement!.appendChild(withBtn);
  return [row, withBtn];
}

describe('строка задания до 559px: место у каждого ребёнка', () => {
  const rules = cascade();

  it('варианты дают всех прямых детей TaskRow — сверка не пустая', () => {
    const keys = new Set(VARIANTS.flatMap(([, el]) => rows(el, 'sk-list').flatMap((r) => [...r.children].map((c) => c.classList[0]))));
    expect([...keys].sort()).toEqual(['cp-task-bar', 'cp-task-body', 'cp-task-check', 'ds-btn', 'ds-chev', 'ds-link', 'pp-row-art'].sort());
  });

  it.each(CONTEXTS)('%s: строка с «Готово» — в сетке, без потерянных детей', (_, wrap) => {
    for (const [name, el] of VARIANTS) {
      for (const row of rows(el, wrap)) {
        if (!row.querySelector(':scope > .ds-btn')) continue;
        expect(rules.some((r) => /display\s*:\s*grid/.test(r.body) && r.selectors.some((s) => row.matches(s))), `${name}: сетка не действует`).toBe(true);
        expect(gridProblems(rules, row), name).toEqual([]);
      }
      cleanup();
    }
  });

  it('полоса «от терапевта» — в первой колонке шаблона, слева от знака', () => {
    const [row] = rows(VARIANTS[0][1], 'sk-list');
    const tpl = rules.flatMap((r) => r.selectors.map((s) => ({ s, body: r.body })))
      .filter((x) => areasOf(x.body) && row.matches(x.s)).sort((a, b) => spec(a.s) - spec(b.s)).pop()!;
    expect(/grid-template-areas\s*:\s*"lead art /.test(tpl.body)).toBe(true);
  });

  it('контрольный образец: сетка r2 (полосе нет места) и место без области в шаблоне — сверка краснеет', () => {
    const r2 = parseRules(`@media (max-width: 559px) {
      .cp-page--phone .cp-task:has(> .ds-btn) { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; }
      .cp-page--phone .cp-task:has(> .ds-btn) > .pp-row-art { grid-column: 1; grid-row: 1 / span 2; }
      .cp-page--phone .cp-task:has(> .ds-btn) > .cp-task-body { grid-column: 2; grid-row: 1; }
      .cp-page--phone .cp-task:has(> .ds-btn) > .ds-btn { grid-column: 2; grid-row: 2; }
      .cp-page--phone .cp-task:has(> .ds-btn) > .ds-chev { grid-column: 3; grid-row: 1 / span 2; } }`);
    const [row] = rows(VARIANTS[0][1], 'cp-page--phone');
    expect(gridProblems(r2, row)).toEqual(['cp-task-bar: нет места в сетке']);
    const noLead = parseRules(`@media (max-width: 559px) {
      .ds-card.cp-task:has(> .ds-btn) { display: grid; grid-template-areas: "art body" "art btn"; }
      .cp-task:has(> .ds-btn) > .cp-task-bar { grid-area: lead; }
      .cp-task:has(> .ds-btn) > .pp-row-art { grid-area: art; }
      .cp-task:has(> .ds-btn) > .cp-task-body { grid-area: body; }
      .cp-task:has(> .ds-btn) > .ds-btn { grid-area: btn; } }`);
    expect(gridProblems(noLead, row)).toEqual(['cp-task-bar: области «lead» нет в шаблоне строки']);
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
