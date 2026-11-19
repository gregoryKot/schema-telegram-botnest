// Кризисная строка в игре. Игра
// нарочно доводит до «сил не осталось», и рядом обязан быть выход — телефон
// доверия (правило №7 CLAUDE.md). game/ — отдельный npm-пакет без доступа к
// shared/, поэтому номер там продублирован строкой. Этот тест держит дубль
// в согласии с источником правды (правило №4: два места, обязанные совпадать,
// фиксируются тестом) и не даёт строке молча исчезнуть с экранов.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// Источник правды — первая (взрослая) линия из CrisisCard.
const hotlines = read('shared/src/utils/crisisMarkers.ts');
const display = /display: '([^']+)'/.exec(hotlines)?.[1];
const tel = /tel: '([^']+)'/.exec(hotlines)?.[1];

describe('кризисная строка игры', () => {
  it('источник правды читается', () => {
    expect(display).toBe('8-800-100-49-94');
    expect(tel).toBe('tel:88001004994');
  });

  it('в текстах «Недели» — взрослая и детская линии из того же источника', () => {
    const week = read('game/src/i18n/week.ts');
    const child = [...hotlines.matchAll(/display: '([^']+)'/g)][1]?.[1];
    expect(child).toBe('8-800-2000-122');
    expect(/m_wk_crisis_adult: wk\("([^"]+)"\)/.exec(week)?.[1]).toContain(
      display,
    );
    expect(/m_wk_crisis_child: wk\("([^"]+)"\)/.exec(week)?.[1]).toContain(
      child,
    );
  });

  it('карточка после хука «Недели» ставит обе линии и ведёт на их tel:', () => {
    const card = read('game/src/week/card.ts');
    const childTel = [...hotlines.matchAll(/tel: '([^']+)'/g)][1]?.[1];
    expect(childTel).toBe('tel:88002000122');
    expect(card).toContain(`const CRISIS_TEL = '${tel}';`);
    expect(card).toContain(`const CRISIS_CHILD_TEL = '${childTel}';`);
    // взрослая линия стоит первой, детская — второй
    expect(card).toMatch(
      /\['m_wk_crisis_adult', CRISIS_TEL\], \['m_wk_crisis_child', CRISIS_CHILD_TEL\]/,
    );
  });
});
