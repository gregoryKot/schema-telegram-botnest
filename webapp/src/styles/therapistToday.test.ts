// @vitest-environment node
// «Сегодня» терапевта (#906, b29): счётчики на бумаге (плитки pp-paper), поэтому
// знаменатель «/ N» красится токеном для бумаги, а не --on-panel-* (токены тёмной подложки).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_MEDIA, DESKTOP_MEDIA } from '../utils/phoneLayout';

const css = readFileSync(join(__dirname, 'therapist-today.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Телефонный блок — последний в файле: всё от его заголовка до конца. */
const phone = css.slice(css.indexOf(`@media ${PHONE_MEDIA}`));
const desk = css.slice(0, css.indexOf(`@media ${PHONE_MEDIA}`));
/** Тело первого правила с ровно этим селектором. */
const rule = (src: string, sel: string) =>
  src.match(new RegExp(`(?:^|[}\\s])${sel.replace(/[.-]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('therapist-today.css: контраст на бумаге', () => {
  it('нет токенов --on-panel-* (их место только на ds-card--panel/--accent)', () => {
    expect(css).not.toMatch(/--on-panel-/);
  });
  it('.tt-denom красится var(--text-sub): на цветной бумаге --text-faint ниже 4.5:1 (ревью r1, L6)', () => {
    const m = css.match(/\.tt-denom\s*\{([^}]*)\}/);
    expect(m?.[1]).toContain('color: var(--text-sub)');
  });
});

// QA 2026-11: имя в «Активности клиентов» на телефоне шло в 12 строк по ~38px —
// трек спарклайна minmax(48px, 120px) добирал 120 раньше доли 1fr имени, а
// overflow-wrap: anywhere рвал имя посреди слова. b29: плотная строка активности —
// одной строкой с многоточием, строки сессий и внимания — до двух строк по словам.
describe('therapist-today.css: имена в строках (QA 2026-11, b29)', () => {
  it('имя в «Активности» — то же .tt-name (до двух строк), а не одна строка с многоточием (ревью r1, L4)', () => {
    const rows = readFileSync(join(__dirname, '../sections/TherapistTodayLists.tsx'), 'utf8');
    expect(rows).toContain('className="tt-name tt-act-name"');
    expect(css).not.toMatch(/\.tt-act-name[^{]*\{[^}]*nowrap/);
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/);
  });
  it('.tt-name — до двух строк, многоточие только на третьей', () => {
    const d = rule(desk, '.tt-name');
    expect(d).toContain('-webkit-line-clamp: 2');
    expect(d).toContain('overflow: hidden');
    expect(d).not.toContain('white-space: nowrap');
  });
  it('колонка «имя + подпись» в сетке строки — min-width: 0', () => {
    expect(rule(desk, '.tt-who')).toContain('min-width: 0');
  });
  it('на телефоне спарклайн строки активности — на минимуме 48, имени отдаётся остаток', () => {
    expect(rule(phone, '.tt-act')).toContain('grid-template-columns: 36px minmax(0, 1fr) 48px 40px auto');
  });
});

// Компьютер (≥768): переход — акцентная «→» как до волн, не телефонный шеврон «›»;
// у строки активности стрелки не было. Телефонный блок эти правила не содержит.
describe('therapist-today.css: стрелка перехода на компьютере', () => {
  const at = css.indexOf(`@media ${DESKTOP_MEDIA} {\n  .tt-session`);
  const deskBlock = at < 0 ? '' : css.slice(at, css.indexOf('\n}', at));
  it('карточки сессии и внимания — «→» только под DESKTOP_MEDIA (≥768)', () => {
    expect(deskBlock).toMatch(/\.tt-session > \.ds-chev:empty::before, \.tt-attn > \.ds-chev:empty::before \{ content: '→'; \}/);
    expect(deskBlock).toMatch(/\.tt-attn > \.ds-chev \{ color: var\(--warn-ink\); \}/);
    expect(deskBlock).toMatch(/\.tt-act > \.ds-chev \{ display: none; \}/);
    expect(phone).not.toMatch(/ds-chev/);
  });
});

// r2 (M4): на 320 строка «Активности» шла в 4–5 строк — спарклайн сбоку отнимал у имени и подписи ~90px.
describe('therapist-today.css: узкий лист «Активности» (до 340px)', () => {
  const at = css.indexOf('@container tt-list (max-width: 340px)');
  const block = at < 0 ? '' : css.slice(at, css.indexOf('\n}', at));
  it('лист — контейнер; имя во всю ширину до индекса, спарклайн — в строке подписи под индексом, шеврона нет', () => {
    expect(rule(desk, '.tt-list')).toContain('container: tt-list / inline-size');
    expect(block).toMatch(/grid-template-areas: "av name idx" "av status spark"/);
    expect(block).toMatch(/\.tt-list > \.tt-act > \.ds-spark \{ grid-area: spark;/);
    expect(block).toMatch(/\.tt-list > \.tt-act > \.ds-chev \{ display: none; \}/);
  });
});

