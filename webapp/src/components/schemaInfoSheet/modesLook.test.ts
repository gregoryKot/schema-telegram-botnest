import { describe, it, expect } from 'vitest';
import { buildModeCheckin, buildModes } from './data';
import { checkinLook, libraryGroupLook } from './modesLook';

const tr = (ty: string) => ty;

describe('libraryGroupLook — бумага и знаки групп справочника', () => {
  const looks = Object.fromEntries(buildModes(tr).map((g) => [g.group, libraryGroupLook(g)]));

  it('у группы одного вида — один знак группы на её бумаге', () => {
    expect(looks['Детские режимы']).toEqual({ hue: 28, signs: ['child_care'] });
    expect(looks['Критикующие режимы']).toEqual({ hue: 310, signs: ['looming'] });
    expect(looks['Здоровые режимы']).toEqual({ hue: 145, signs: ['together'] });
  });

  it('копинги — три стиля, три знака по порядку строк, бумага копингов', () => {
    expect(looks['Дисфункциональные копинги']).toEqual({ hue: 240, signs: ['yield', 'shelter', 'shield'] });
  });

  it('соседние группы — разной бумаги', () => {
    const hues = buildModes(tr).map((g) => libraryGroupLook(g).hue);
    hues.slice(1).forEach((h, i) => expect(h).not.toBe(hues[i]));
  });
});

describe('checkinLook — плитка чек-ина', () => {
  const items = buildModeCheckin(tr);
  const by = (label: string) => checkinLook(items.find((i) => i.label === label)!);

  it('режим берёт бумагу и знак своей группы', () => {
    expect(by('Одиноко / страшно')).toEqual({ hue: 28, sign: 'child_care' });
    expect(by('Хочу отключиться')).toEqual({ hue: 240, sign: 'shelter' });
    expect(by('Соглашаюсь, хотя не хочу')).toEqual({ hue: 240, sign: 'yield' });
    expect(by('Контролирую / превосхожу')).toEqual({ hue: 240, sign: 'shield' });
    expect(by('Спокойно и устойчиво')).toEqual({ hue: 145, sign: 'together' });
  });

  it('«Сердитый Ребёнок» — свой знак Flare на бумаге детских режимов (решение 6)', () => {
    expect(by('Злюсь / несправедливо')).toEqual({ hue: 28, sign: 'flare' });
  });

  it('у каждой плитки есть знак', () => {
    items.forEach((i) => expect(checkinLook(i).sign).toBeTruthy());
  });
});
