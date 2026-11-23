// Разбор текста листа: метки книг отдельно, свёртка длинного пункта до первой фразы, подписи оглавления.
import { describe, it, expect } from 'vitest';
import { foldFirstSentence, splitCites, tocLabel } from './guideTextModel';

const LONG = 'Останавливать Критика при первом же появлении и называть по имени: ограниченное родительство само по себе противоядие [Арнтц ПРЛ, гл. 8]. '
  + 'Если клиент резко «переключился», спросить, не услышал ли Критик наказание в словах терапевта, и вернуться к Уязвимому Ребёнку.';

describe('splitCites', () => {
  it('метка с пробелом перед ней — отдельный кусок, текст вокруг цел', () => {
    expect(splitCites('Суть [Кембридж, гл. 8]. Дальше')).toEqual([
      { text: 'Суть', cite: false }, { text: ' [Кембридж, гл. 8]', cite: true }, { text: '. Дальше', cite: false },
    ]);
  });
  it('без меток — один кусок', () => {
    expect(splitCites('просто текст')).toEqual([{ text: 'просто текст', cite: false }]);
  });
});

describe('foldFirstSentence', () => {
  it('длинный пункт — первая фраза с меткой книги и остаток', () => {
    const f = foldFirstSentence(LONG)!;
    expect(f.head).toMatch(/противоядие \[Арнтц ПРЛ, гл\. 8\]\.$/);
    expect(f.rest).toMatch(/^Если клиент/);
  });
  it('«гл. 8» внутри скобок и сокращения перед цифрой фразу не рвут', () => {
    const t = `${'Слово '.repeat(30)}по [Арнтц, гл. 9] и см. 3 раздел. ${'Ещё фраза длинная '.repeat(5)}`;
    expect(foldFirstSentence(t)!.head).toMatch(/3 раздел\.$/);
  });
  it('короткий пункт и пункт одной фразой — целиком', () => {
    expect(foldFirstSentence('Коротко. Ещё коротко.')).toBeNull();
    expect(foldFirstSentence('без точки '.repeat(40))).toBeNull();
  });
  it('остаток короче порога — целиком', () => {
    expect(foldFirstSentence(`${'а '.repeat(120)}. Хвост.`)).toBeNull();
  });
});

describe('tocLabel', () => {
  it('длинные подписи — коротко, прочие — как есть', () => {
    expect(tocLabel('Как это звучит')).toBe('Звучит');
    expect(tocLabel('Между сессиями')).toBe('Дома');
    expect(tocLabel('На сессии')).toBe('На сессии');
  });
});
