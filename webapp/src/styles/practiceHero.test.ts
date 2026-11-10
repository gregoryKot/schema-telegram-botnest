// @vitest-environment node
// Герой дыхания на «Практиках» телефона (ревью g4): сцена 248px над заголовком занимала первый экран —
// на 360×640 «Начать дыхание» уходило под нижнее меню, на 390×844 квадраты и строки «Мне плохо» — за
// сгиб. На странице телефона сцена — 112–140px справа от надписи и заголовка; крупная (до 248px) —
// только у листа из ⌘K и итога разбора. Высота блока действий — по главной кнопке (карточка не прыгает,
// когда «Начать дыхание» сменяется «Достаточно»). CSS в jsdom не считается — сверка исходников.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from './cssRules.test-helpers';

const rules = (f: string) => parseRules(readFileSync(join(__dirname, f), 'utf8'));
const decl = (f: string, sel: string) => rules(f).filter((r) => !r.media && r.selectors.includes(sel)).map((r) => r.body).join(';');

describe('герой дыхания на «Практиках»', () => {
  it('телефон: сцена 112–140px колонкой справа от надписи и заголовка', () => {
    const cols = decl('client-practice.css', '.cp-page--phone .qb-in').match(/grid-template-columns:\s*minmax\(0, 1fr\) (\d+)px/);
    expect(cols).not.toBeNull();
    const w = Number(cols![1]);
    expect(w).toBeGreaterThanOrEqual(112);
    expect(w).toBeLessThanOrEqual(140);
    expect(decl('client-practice.css', '.cp-page--phone .qb-scene')).toMatch(/grid-column:\s*2/);
    expect(decl('client-practice.css', '.cp-page--phone .qb-body')).toMatch(/display:\s*contents/);
  });

  it('лист дыхания вне страницы держит крупную сцену 248px', () => {
    expect(decl('breathing.css', '.qb-scene')).toMatch(/width:\s*min\(100%, 248px\)/);
  });

  it('блок действий не короче главной кнопки (48px)', () => {
    expect(decl('breathing.css', '.qb-actions')).toMatch(/min-height:\s*48px/);
  });
});
