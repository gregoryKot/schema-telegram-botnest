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

  it('нажатие ведёт на тот же tel:, что и карточка продукта', () => {
    expect(scene).toContain(`const CRISIS_TEL = '${tel}';`);
  });

  it('строка стоит на экране смерти и на обеих финальных CTA', () => {
    // одно объявление хелпера + три вызова: gameOver, showBranch, showTherapyCta
    expect(scene.match(/addCrisisLine\(/g)).toHaveLength(4);
  });
});
