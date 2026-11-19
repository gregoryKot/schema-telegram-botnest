// Кризисная строка в игре (docs/GAME_IMPROVEMENT_PLAN.md, пункт 0.1). Игра
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

const messages = read('game/src/i18n/messages.ts');
const scene = read('game/src/scenes/GameScene.ts');
// экран смерти, развилка и CTA живут отдельными модулями сцены
const cta = read('game/src/scenes/game/cta.ts');
const screens =
  scene +
  read('game/src/scenes/game/death.ts') +
  cta +
  read('game/src/scenes/game/cabinet.ts');

describe('кризисная строка игры', () => {
  it('источник правды читается', () => {
    expect(display).toBe('8-800-100-49-94');
    expect(tel).toBe('tel:88001004994');
  });

  it('в текстах игры — тот же номер, что в CrisisCard (ru и en)', () => {
    const line = /m_crisis_line: \{ ru: "([^"]+)", en: "([^"]+)" \}/.exec(
      messages,
    );
    expect(line).not.toBeNull();
    expect(line?.[1]).toContain(display);
    expect(line?.[2]).toContain(display);
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

  it('нажатие ведёт на тот же tel:, что и карточка продукта', () => {
    expect(cta).toContain(`const CRISIS_TEL = '${tel}';`);
  });

  it('строка стоит на экране смерти и на всех трёх финальных CTA', () => {
    // одно объявление хелпера + четыре вызова: gameOver, showBranch, showCta, showTherapyCta
    expect(screens.match(/addCrisisLine\(/g)).toHaveLength(5);
  });

  // Тело функции верхнего уровня: от `function имя(` до первой `}` в начале строки.
  const fnBody = (src: string, fn: string): string => {
    const start = src.indexOf(`function ${fn}(`);
    const end = src.indexOf('\n}\n', start);
    return start === -1 || end === -1 ? '' : src.slice(start, end);
  };

  it.each(['showBranch', 'showCta'])('%s сам зовёт addCrisisLine', (fn) => {
    expect(fnBody(cta, fn)).toContain('addCrisisLine(');
  });

  it('контрольный: тело функции без вызова строку не находит', () => {
    expect(fnBody(cta, 'modeShort')).not.toBe('');
    expect(fnBody(cta, 'modeShort')).not.toContain('addCrisisLine(');
  });
});
