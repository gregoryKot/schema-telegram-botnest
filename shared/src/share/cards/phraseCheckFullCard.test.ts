// @vitest-environment jsdom
// Карточки разбора фразы: какие приметы попадают на полную карточку, когда
// доступна краткая («было → стало» без переписанной фразы не бывает), и что
// обе рисовалки не падают на краевых данных (пустой список примет, разбор
// без переписывания). Канвас в jsdom не реализован — контекст подменяем,
// как в соседних card-тестах.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { canvasWithMockCtx, printedText } from './canvas.test-helpers';
import {
  phraseCheckMarkLabels,
  phraseCheckShareOptions,
  drawPhraseCheckFullCard,
} from './phraseCheckFullCard';
import { drawPhraseCheckCard } from './phraseCheckCard';
import { PHRASE_MARK_IDS } from '../../phraseCheck/criteria';

afterEach(() => {
  vi.restoreAllMocks();
});

const LINK = 'https://t.me/bot';

describe('phraseCheckMarkLabels', () => {
  it('подписи идут в порядке таблицы, а не в порядке ответов', () => {
    expect(phraseCheckMarkLabels(['worth', 'goal'])).toEqual([
      'ткнуть в промах',
      'ценность от результата',
    ]);
  });

  it('дубли и незнакомые id не попадают на карточку', () => {
    expect(phraseCheckMarkLabels(['goal', 'goal'])).toEqual([
      'ткнуть в промах',
    ]);
    expect(phraseCheckMarkLabels(['выдумка' as never])).toEqual([]);
  });

  it('ни одной приметы — пустой список (карточка скажет об этом сама)', () => {
    expect(phraseCheckMarkLabels([])).toEqual([]);
  });
});

describe('phraseCheckShareOptions', () => {
  it('есть фраза и переписанный вариант — доступны обе карточки', () => {
    const o = phraseCheckShareOptions(
      'ни на что не гожусь',
      ['goal'],
      'вышло неточно',
      LINK,
    );
    expect(o.hasShort).toBe(true);
    expect(o.hasFull).toBe(true);
    expect(o.shortProps?.eventKind).toBe('phrase_check');
    expect(o.fullProps?.eventKind).toBe('phrase_check_full');
  });

  it('без переписанной фразы краткой карточки нет — делиться нечем', () => {
    const o = phraseCheckShareOptions('фраза', ['goal'], '   ', LINK);
    expect(o.hasShort).toBe(false);
    expect(o.shortProps).toBeNull();
    expect(o.hasFull).toBe(true);
  });

  it('без самой фразы недоступно ничего', () => {
    const o = phraseCheckShareOptions('  ', [], null, LINK);
    expect(o.hasShort).toBe(false);
    expect(o.hasFull).toBe(false);
    expect(o.fullProps).toBeNull();
  });

  it('в тексте шаринга — только ссылка, сама фраза остаётся на картинке', () => {
    const o = phraseCheckShareOptions(
      'очень личная фраза',
      ['goal'],
      'переписанная',
      LINK,
    );
    expect(o.shortProps?.shareText).toContain(LINK);
    expect(o.shortProps?.shareText).not.toContain('очень личная фраза');
    expect(o.fullProps?.shareText).not.toContain('очень личная фраза');
    expect(o.fullProps?.shareText).not.toContain('переписанная');
  });
});

describe('рисование карточек', () => {
  it('краткая карточка печатает обе реплики', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawPhraseCheckCard(canvas, {
      phrase: 'ни на что не гожусь',
      rewrite: 'вышло неточно, поправлю',
    });
    // Подписи блоков кит печатает капсом — сверяем без учёта регистра.
    const printed = printedText(ctx).toLowerCase();
    expect(printed).toContain('было');
    expect(printed).toContain('стало');
    expect(printed).toContain('ни на что не гожусь');
    expect(printed).toContain('вышло неточно, поправлю');
  });

  it('полная карточка печатает вердикт, счёт примет и их подписи', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawPhraseCheckFullCard(canvas, {
      phrase: 'ни на что не гожусь',
      marks: ['goal', 'person'],
      rewrite: 'вышло неточно',
    });
    const printed = printedText(ctx);
    expect(printed).toContain('Почти забота');
    expect(printed).toContain(`2 из ${PHRASE_MARK_IDS.length} примет критика`);
    expect(printed).toContain('ткнуть в промах');
    expect(printed.toLowerCase()).toContain('стало');
  });

  it('разбор без примет: карточка говорит об этом прямо, а не оставляет пустоту', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawPhraseCheckFullCard(canvas, { phrase: 'вышло неточно', marks: [] });
    const printed = printedText(ctx);
    expect(printed).toContain('ни одной приметы критика');
    // Переписывать было нечего — блока «стало» на карточке нет.
    expect(printed.toLowerCase()).not.toContain('стало');
  });

  it('все девять примет рисуются без обрезки списка', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawPhraseCheckFullCard(canvas, {
      phrase: 'фраза',
      marks: [...PHRASE_MARK_IDS],
    });
    const printed = printedText(ctx);
    for (const label of phraseCheckMarkLabels([...PHRASE_MARK_IDS])) {
      expect(printed).toContain(label);
    }
  });
});
